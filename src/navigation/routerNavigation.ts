import type { Href, Router } from 'expo-router';

export type NavigationParams = Record<
  string,
  string | number | (string | number)[] | null | undefined
>;

export type AppNavigation = {
  navigate: (name: string, params?: NavigationParams) => void;
  replace: (name: string, params?: NavigationParams) => void;
  goBack: () => void;
};

function buildHref(name: string, params?: NavigationParams): Href {
  const normalized = name.trim().toLowerCase();

  if (normalized === 'camera') {
    return params ? { pathname: '/camera', params } : '/camera';
  }

  if (normalized === 'detail') {
    return params ? { pathname: '/detail', params } : '/detail';
  }

  return '/';
}

export function createExpoNavigation(router: Router): AppNavigation {
  return {
    navigate(name, params) {
      router.push(buildHref(name, params));
    },
    replace(name, params) {
      router.replace(buildHref(name, params));
    },
    goBack() {
      router.back();
    },
  };
}