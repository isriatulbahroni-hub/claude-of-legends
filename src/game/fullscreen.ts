// Fullscreen helpers: entering the match takes the whole screen so a
// misclick past the window edge cannot yank focus mid-fight. Browsers only
// grant the request inside a user gesture, which is why the entry points
// are click handlers (lock-in, the escape menu button). Esc always exits
// fullscreen at the browser's discretion; that cannot be prevented.

// Resolves once the request has been answered, so a caller that wants the
// screen turned as well (game/orientation.ts) can ask the moment the
// document is fullscreen, which is the only state a lock is granted in.
export function requestGameFullscreen(): Promise<void> {
  if (document.fullscreenElement) return Promise.resolve();
  return document.documentElement.requestFullscreen?.().catch(() => undefined) ?? Promise.resolve();
}

export function toggleGameFullscreen(): void {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => undefined);
  } else {
    requestGameFullscreen();
  }
}

// Calls back each time the document enters (true) or leaves (false)
// fullscreen, whoever asked: the game's own buttons, the browser's Esc, a
// phone's Back. Returns the stop.
export function watchFullscreen(
  onChange: (fullscreen: boolean) => void,
  doc: Pick<Document, 'fullscreenElement' | 'addEventListener' | 'removeEventListener'> = document,
): () => void {
  let was = doc.fullscreenElement != null;
  const onEvent = (): void => {
    const now = doc.fullscreenElement != null;
    if (now === was) return;
    was = now;
    onChange(now);
  };
  doc.addEventListener('fullscreenchange', onEvent);
  return () => doc.removeEventListener('fullscreenchange', onEvent);
}

// In fullscreen the browser keeps Esc for itself: it leaves fullscreen
// (and frees the locked cursor, game/cursor_lock.ts), and the page never
// sees the key, so the pause menu it was pressed for stayed shut and the
// next Esc was needed. A phone's Back is spent the same way. So leaving
// fullscreen mid-match opens the pause menu, unless it is up already (its
// own Toggle fullscreen button), the match is over, or a chat line is
// being typed (that Esc was the chat's).
export function pauseOnFullscreenExit(cover: {
  pauseMenu: boolean;
  ended: boolean;
  typing: boolean;
}): boolean {
  return !cover.pauseMenu && !cover.ended && !cover.typing;
}
