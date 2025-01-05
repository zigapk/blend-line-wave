import { useCallback, useEffect, useRef, useState } from 'react';
import { useMicrophone } from '~/lib/providers/microphone-provider';

const lineCount = 130;

const getControlPoints = (N: number) =>
  Array.from({ length: N }, () => ({
    x: Math.random() * 3 - 1,
    y: Math.random() * 3 - 1,
    vx: Math.random() * 0.001 - 0.0005,
    vy: Math.random() * 0.001 - 0.0005,
    amplitude: 0.5 + Math.random() * 0.8,
    frequency: 0.03 + Math.random() * 0.04,
    phase: Math.random() * 2 * Math.PI,
    z: 0.5 - Math.random() * 0.5,
  }));

const startTime = performance.now();

type ControlPoint = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  amplitude: number;
  frequency: number;
  phase: number;
  z: number;
};

const smoothData = (data: Float32Array, windowSize: number): number[] => {
  const smoothed = [];
  for (let i = 0; i < data.length; i++) {
    let sum = 0;
    const count = Math.min(windowSize, data.length - i);
    for (let j = 0; j < count; j++) {
      sum += data[i + j];
    }
    smoothed.push(sum / count);
  }
  return smoothed;
};

function interpolateZ(x: number, y: number, points: ControlPoint[]): number {
  let numerator = 0;
  let denominator = 0;
  for (const p of points) {
    const dx = x - p.x;
    const dy = y - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
    const w = 1 / (dist * dist);
    numerator += p.z * w;
    denominator += w;
  }
  return numerator / denominator;
}

const MicrophoneRecorder = () => {
  const { isRecording, startRecording, stopRecording, frequencyDataRef } =
    useMicrophone();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [N, setN] = useState(0);
  const [canvasHeight, setCanvasHeight] = useState(0);
  const [controlPoints, setControlPoints] = useState(getControlPoints(N));
  // History data (array containing lineCount arrays of bufferLength values)
  const historyRef = useRef<number[][]>(
    Array.from({ length: 4 * lineCount }, () => new Array(72).fill(0)),
  );
  // Store the previously displayed data for temporal smoothing
  const prevDataRef = useRef<number[]>(new Array(72).fill(0));

  useEffect(() => {
    const handleResize = () => {
      const windowArea = window.innerWidth * window.innerHeight;
      const newN = Math.floor(windowArea * 0.0001);
      setN(newN);
      setCanvasHeight(Math.min(window.innerHeight * 0.8, 800));
      setControlPoints(getControlPoints(newN));
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const updateControlPoints = useCallback(() => {
    const now = performance.now();
    const t = (now - startTime) / 1000;
    for (const p of controlPoints) {
      p.z = p.amplitude * Math.sin(2 * Math.PI * p.frequency * t + p.phase);
      p.x += p.vx;
      p.y += p.vy;

      if (p.x > 2) p.x = -1;
      if (p.x < -1) p.x = 2;
      if (p.y > 2) p.y = -1;
      if (p.y < -1) p.y = 2;
    }

    // Spatial smoothing
    const data =
      frequencyDataRef.current.length > 0
        ? frequencyDataRef.current
        : new Float32Array(72);
    const smoothedData = smoothData(data, 4);

    // Temporal smoothing: blend with previous frame's data
    const alpha = 0.03; // adjust this value to control smoothing strength

    for (let i = 0; i < smoothedData.length; i++) {
      smoothedData[i] =
        prevDataRef.current[i] * (1 - alpha) + smoothedData[i] * alpha;
    }

    // Update prevData for next frame
    prevDataRef.current = smoothedData.slice();

    // console.log(smoothedData, frequencyData);
    // console.log(smoothedData.length, historyRef.current[0].length);

    // Shift the history data one step forward and read the new data into the first slot
    historyRef.current.unshift(smoothedData);
    historyRef.current.pop();
  }, [controlPoints, frequencyDataRef]);

  useEffect(() => {
    const interval = setInterval(updateControlPoints, 1000 / 60);
    return () => clearInterval(interval);
  }, [updateControlPoints]);

  const handleRecordToggle = async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext('2d');
    const dpi = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpi;
    canvas.height = canvas.offsetHeight * dpi;
    canvasCtx?.scale(dpi, dpi);

    let animationFrameId: number;

    const renderFrequencyData = () => {
      if (!canvasCtx) return;

      // Clear the canvas
      canvasCtx.clearRect(0, 0, canvas.width / dpi, canvas.height / dpi);

      const bufferLength = historyRef.current[0].length;

      const sliceWidth = canvas.width / dpi / (bufferLength - 1);
      const centerY = canvas.height / (2 * dpi);

      const margin = 40;
      const amplitudeFactor = 0.9;

      canvasCtx.lineJoin = 'round';
      canvasCtx.lineCap = 'round';
      canvasCtx.lineWidth = 1;

      for (let lineIndex = 0; lineIndex < lineCount; lineIndex++) {
        // canvasCtx.globalAlpha = 1 - lineIndex * 0.008;
        canvasCtx.globalAlpha = canvasCtx.globalAlpha * 0.99;
        const progress = lineIndex / (lineCount - 1);
        // canvasCtx.globalAlpha = Math.exp(-progress * 1);
        canvasCtx.strokeStyle = '#408BE58D';
        canvasCtx.lineWidth = 0.5 + (1 - progress);

        const points: { x: number; y: number }[] = [];
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
          const normalizedX = i / (bufferLength - 1);
          const normalizedY = lineIndex / (lineCount - 1);

          // Interpolate amplitude scale from our control points
          const amplitudeScale = interpolateZ(
            normalizedX,
            normalizedY,
            controlPoints,
          );

          const rawValue = historyRef.current[lineIndex * 4][i] - 0.5;
          const planeOffset = amplitudeScale - 0.5;
          // const planeOffset = 0;

          // Combine sound value and animated plane data and scale
          const scaledValue = (rawValue + planeOffset * 0.5) * amplitudeFactor;
          const distanceFactor =
            ((lineCount - lineIndex) / lineCount) * 0.75 + 0.25;
          const perspectiveValue = scaledValue * distanceFactor;

          const y =
            centerY - perspectiveValue * (canvas.height / (2 * dpi) - margin);

          points.push({ x, y });
          x += sliceWidth;
        }

        canvasCtx.beginPath();
        canvasCtx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length - 2; i++) {
          const xc = (points[i].x + points[i + 1].x) / 2;
          const yc = (points[i].y + points[i + 1].y) / 2;
          canvasCtx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
        }
        canvasCtx.quadraticCurveTo(
          points[points.length - 2].x,
          points[points.length - 2].y,
          points[points.length - 1].x,
          points[points.length - 1].y,
        );

        canvasCtx.stroke();
      }

      canvasCtx.globalAlpha = 1.0;

      animationFrameId = requestAnimationFrame(renderFrequencyData);
    };

    animationFrameId = requestAnimationFrame(renderFrequencyData);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [controlPoints]);

  return (
    <div className="w-full">
      <div className="flex w-full flex-row items-center justify-center p-4">
        <button
          type="button"
          className="rounded-lg bg-blue-500 px-4 py-2 text-white"
          onClick={handleRecordToggle}>
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width="100%"
        height={canvasHeight}
        style={{ width: '100%', height: canvasHeight }}
      />
    </div>
  );
};

export default MicrophoneRecorder;
