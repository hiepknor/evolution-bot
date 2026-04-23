import { useEffect, useState } from 'react';

export type ScreenFlag = 'small-screen' | 'medium-screen' | 'full-screen';

const SMALL_SCREEN_MAX = 1023;
const FULL_SCREEN_MIN = 1600;
const SCREEN_FLAG_HYSTERESIS_PX = 24;
const SCREEN_FLAGS: ScreenFlag[] = ['small-screen', 'medium-screen', 'full-screen'];

const resolveScreenFlag = (width: number, previous?: ScreenFlag): ScreenFlag => {
  if (previous === 'small-screen') {
    if (width <= SMALL_SCREEN_MAX + SCREEN_FLAG_HYSTERESIS_PX) {
      return 'small-screen';
    }
  } else if (previous === 'full-screen') {
    if (width >= FULL_SCREEN_MIN - SCREEN_FLAG_HYSTERESIS_PX) {
      return 'full-screen';
    }
  } else if (previous === 'medium-screen') {
    if (width <= SMALL_SCREEN_MAX - SCREEN_FLAG_HYSTERESIS_PX) {
      return 'small-screen';
    }
    if (width >= FULL_SCREEN_MIN + SCREEN_FLAG_HYSTERESIS_PX) {
      return 'full-screen';
    }
    return 'medium-screen';
  }

  if (width <= SMALL_SCREEN_MAX) {
    return 'small-screen';
  }
  if (width >= FULL_SCREEN_MIN) {
    return 'full-screen';
  }
  return 'medium-screen';
};

const getInitialScreenFlag = (): ScreenFlag => {
  if (typeof window === 'undefined') {
    return 'medium-screen';
  }
  return resolveScreenFlag(window.innerWidth);
};

export const useScreenFlag = (): ScreenFlag => {
  const [screenFlag, setScreenFlag] = useState<ScreenFlag>(() => getInitialScreenFlag());

  useEffect(() => {
    let rafId: number | null = null;

    const updateScreenFlag = () => {
      setScreenFlag((prev) => resolveScreenFlag(window.innerWidth, prev));
    };

    const scheduleUpdateScreenFlag = () => {
      if (rafId !== null) {
        return;
      }
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        updateScreenFlag();
      });
    };

    updateScreenFlag();
    window.addEventListener('resize', scheduleUpdateScreenFlag);
    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener('resize', scheduleUpdateScreenFlag);
    };
  }, []);

  useEffect(() => {
    const rootElement = document.documentElement;
    rootElement.dataset.screen = screenFlag;
    rootElement.classList.remove(...SCREEN_FLAGS);
    rootElement.classList.add(screenFlag);

    return () => {
      rootElement.classList.remove(...SCREEN_FLAGS);
      rootElement.removeAttribute('data-screen');
    };
  }, [screenFlag]);

  return screenFlag;
};
