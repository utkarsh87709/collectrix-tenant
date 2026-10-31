// The signed-in user's profile photo, for the sidebar's account card. Login
// doesn't return it, so it's read from myProfile once per session and shared
// across page changes. The profile panel pushes the new URL after an upload,
// and logout clears it so the next user never sees the previous one's photo.
import { useEffect, useSyncExternalStore } from "react";
import { getMyProfile } from "./profile-api";

/** undefined = not loaded yet; null = the user has no photo. */
let photo: string | null | undefined;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setProfilePhoto(url: string | null) {
  photo = url;
  emit();
}

export function resetProfilePhoto() {
  photo = undefined;
  loading = null;
  emit();
}

// A failed load leaves the photo unloaded, so the next mount tries again.
function loadProfilePhoto() {
  if (photo !== undefined || loading) return;
  const current = (loading = getMyProfile()
    .then((p) => {
      if (loading === current) setProfilePhoto(p.profilePic || null);
    })
    .catch(() => {})
    .finally(() => {
      if (loading === current) loading = null;
    }));
}

export function useProfilePhoto(): string | null {
  const url = useSyncExternalStore(
    subscribe,
    () => photo ?? null,
    () => null,
  );
  useEffect(loadProfilePhoto, []);
  return url;
}
