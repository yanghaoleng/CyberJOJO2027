export const LIBRARY_TABS = Object.freeze([
  { id: "days", label: "时光小记" },
  { id: "all", label: "全部" },
  { id: "friends", label: "收集" },
]);

export function getLibraryTabAfterSwipe(currentTab, deltaX, minimumDistance = 48) {
  if (Math.abs(deltaX) < minimumDistance) return currentTab;

  const currentIndex = LIBRARY_TABS.findIndex(({ id }) => id === currentTab);
  if (currentIndex < 0) return currentTab;

  const nextIndex = Math.max(
    0,
    Math.min(LIBRARY_TABS.length - 1, currentIndex + (deltaX < 0 ? 1 : -1)),
  );
  return LIBRARY_TABS[nextIndex].id;
}
