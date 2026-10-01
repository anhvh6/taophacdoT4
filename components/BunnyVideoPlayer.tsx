import React from 'react';

export function BunnyVideoPlayer({ url }: { url: string }) {
  return (
    <iframe src={url} title="Video hướng dẫn bài tập"
      className="w-full h-full min-h-0 border-0 bg-black" loading="eager"
      allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen />
  );
}
