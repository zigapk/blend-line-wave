import {
  type PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { WavRecorder } from '~/lib/wavtools';

interface MicrophoneContextType {
  isRecording: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  // Instead of frequencyData as state, we expose a ref:
  frequencyDataRef: React.MutableRefObject<Float32Array>;
}

const MicrophoneContext = createContext<MicrophoneContextType | null>(null);

export const MicrophoneProvider = ({
  children,
}: PropsWithChildren<Record<string, unknown>>) => {
  const wavRecorderRef = useRef<WavRecorder>(
    new WavRecorder({ sampleRate: 24000 }),
  );

  // Keep track of recording status in state
  const [isRecording, setIsRecording] = useState(false);

  // Store the actual frequency data in a ref
  const frequencyDataRef = useRef<Float32Array>(new Float32Array(0));

  // Start recording
  const startRecording = useCallback(async () => {
    const wavRecorder = wavRecorderRef.current;

    try {
      await wavRecorder.begin();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  }, []);

  // Stop recording
  const stopRecording = useCallback(async () => {
    const wavRecorder = wavRecorderRef.current;

    try {
      await wavRecorder.end();
      setIsRecording(false);
      frequencyDataRef.current = new Float32Array(0); // Reset frequency data in the ref
    } catch (error) {
      console.error('Error stopping recording:', error);
    }
  }, []);

  useEffect(() => {
    let animationFrameId: number | null = null;

    const updateFrequencyData = () => {
      // Get the latest frequency data
      const data = wavRecorderRef.current.getFrequencies('voice');
      // Write into ref instead of calling setState
      frequencyDataRef.current = new Float32Array(data.values);

      animationFrameId = requestAnimationFrame(updateFrequencyData);
    };

    if (isRecording) {
      updateFrequencyData();
    } else {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
    }

    return () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isRecording]);

  const value: MicrophoneContextType = {
    isRecording,
    startRecording,
    stopRecording,
    frequencyDataRef, // We now pass the ref instead of a state variable
  };

  return (
    <MicrophoneContext.Provider value={value}>
      {children}
    </MicrophoneContext.Provider>
  );
};

export const useMicrophone = () => {
  const context = useContext(MicrophoneContext);
  if (!context) {
    throw new Error('useMicrophone must be used within a MicrophoneProvider');
  }
  return context;
};
