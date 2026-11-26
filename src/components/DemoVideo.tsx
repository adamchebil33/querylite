import { useEffect, useRef, useState } from 'react';

/**
 * The demo video on the landing page. Browsers only autoplay muted video, so it
 * plays silently on a loop while it is on screen (and only starts downloading
 * then), and pauses when scrolled away. "Turn on sound" unmutes it where it is
 * and brings up the browser's own controls. Visitors who ask for reduced motion
 * get the still poster with the controls instead.
 */
export function DemoVideo() {
  const video = useRef<HTMLVideoElement>(null);
  const [reducedMotion] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  );
  const [withSound, setWithSound] = useState(false);
  const preview = !reducedMotion && !withSound;

  useEffect(() => {
    const el = video.current;
    if (!el || !preview) return;
    el.muted = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) el.play().catch(() => {});
        else el.pause();
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [preview]);

  const turnOnSound = () => {
    const el = video.current;
    if (!el) return;
    setWithSound(true);
    el.muted = false;
    el.play().catch(() => {});
  };

  return (
    <div className="relative">
      <video
        ref={video}
        src="/media/demo.mp4"
        poster="/media/demo-poster.jpg"
        width={1920}
        height={1080}
        muted={preview}
        loop={preview}
        controls={!preview}
        playsInline
        preload="none"
        aria-label="Querylite demo video, 78 seconds"
        data-testid="landing-video"
        className="block h-auto w-full bg-paper"
      />
      {preview && (
        <button
          type="button"
          onClick={turnOnSound}
          className="btn btn-primary absolute bottom-2 left-2 !px-2 !py-1 !text-[12px] sm:bottom-4 sm:left-4 sm:!px-3 sm:!py-1.5 sm:!text-[13px]"
        >
          <svg viewBox="0 0 24 24" aria-hidden className="h-3.5 w-3.5 sm:h-4 sm:w-4">
            <path
              d="M11 4.7a.7.7 0 0 0-1.19-.5L6.4 7.6A1.4 1.4 0 0 1 5.4 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.4a1.4 1.4 0 0 1 1 .4l3.4 3.4a.7.7 0 0 0 1.2-.5z"
              fill="currentColor"
            />
            <path
              d="M22 9l-6 6M16 9l6 6"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
            />
          </svg>
          Turn on sound
        </button>
      )}
    </div>
  );
}
