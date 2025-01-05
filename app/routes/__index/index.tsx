import MicrophoneRecorder from '~/components/microphone-recorder';
import useTranslation from '~/i18n/i18n';

export default function Index() {
  const { t } = useTranslation();

  return (
    <div className="flex w-full flex-col items-center justify-center gap-5">
      <MicrophoneRecorder />
    </div>
  );
}
