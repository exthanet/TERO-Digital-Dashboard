// Reads comments/{Platform}_{postId} (written by the daily sync, lib/integrations/commentsCollect.ts)
// for the clip detail panel. Only people with วิเคราะห์เชิงลึก may read them: for
// everyone else this returns "denied" and the panel shows nothing.
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ClipComments } from "@/lib/integrations/commentsCollect";

export type { ClipComments, CommentItem } from "@/lib/integrations/commentsCollect";

const docIdOf = (platform: string, id: string) => `${platform}_${id}`.replace(/\//g, "_");

/** The clip's comments, null when none were collected, "denied" without the permission. */
export async function loadClipComments(platform: string, postId: string): Promise<ClipComments | null | "denied"> {
  try {
    const snap = await getDoc(doc(db, "comments", docIdOf(platform, postId)));
    return snap.exists() ? (snap.data() as ClipComments) : null;
  } catch (e) {
    if ((e as { code?: string })?.code === "permission-denied") return "denied";
    throw e;
  }
}
