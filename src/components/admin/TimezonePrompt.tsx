import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/tenant/ui";
import { useAuth } from "@/lib/auth-context";
import {
  getMyProfile,
  getTimezoneList,
  updateProfile,
  type MyProfile,
  type TimezoneItem,
} from "@/lib/profile-api";

// Users choose their own timezone — nothing is preselected for them. Until
// myProfile has one saved, this blocks the app (no close button, Escape and
// outside clicks do nothing) and asks for it; it is checked after every login
// and page load, so it never shows again once a timezone is saved. Changing it
// later happens in My Profile.
export function TimezonePrompt() {
  const { user } = useAuth();
  const userId = user?.userId;
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [timezones, setTimezones] = useState<TimezoneItem[]>([]);
  const [choice, setChoice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setProfile(null);
    setChoice("");
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const p = await getMyProfile();
      if (cancelled || p.timezone) return;
      const { timezoneList } = await getTimezoneList();
      if (cancelled) return;
      setTimezones(timezoneList ?? []);
      setProfile(p);
    })().catch(() => {
      // Don't lock the app on a failed lookup — the next page load checks again.
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!profile) return null;

  const save = async () => {
    setSaving(true);
    try {
      await updateProfile({
        firstName: profile.firstName ?? "",
        lastName: profile.lastName ?? "",
        phoneNo: profile.phoneNo ?? "",
        timezone: choice,
      });
      toast.success("Timezone saved");
      setProfile(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save timezone");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AlertDialog open>
      <AlertDialogContent onEscapeKeyDown={(e) => e.preventDefault()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Select your timezone</AlertDialogTitle>
          <AlertDialogDescription>
            Choose the timezone you work in before continuing. You can change it later in My
            Profile.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <NativeSelect value={choice} onChange={(e) => setChoice(e.target.value)} disabled={saving}>
          <option value="" disabled>
            Select timezone
          </option>
          {timezones.map((tz) => (
            <option key={tz.timezone} value={tz.timezone}>
              {tz.timezone}
            </option>
          ))}
        </NativeSelect>
        <AlertDialogFooter>
          <Button onClick={save} disabled={!choice || saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save and continue
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
