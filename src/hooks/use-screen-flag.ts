import { useEffect, useState } from 'react';

export type ScreenFlag = 'small-screen' | 'medium-screen' | 'full-screen';

const SMALL_SCREEN_MAX = 1023;
const FULL_SCREEN_MIN = 1600;
const SCREEN_FLAGS: ScreenFlag[] = ['small-screen', 'medium-screen', 'full-screen'];

const resolveScreenFlag = (width: number): ScreenFlag => {
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
    const updateScreenFlag = () => {
      setScreenFlag(resolveScreenFlag(window.innerWidth));
    };

    updateScreenFlag();
    window.addEventListener('resize', updateScreenFlag);
    return () => window.removeEventListener('resize', updateScreenFlag);
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
