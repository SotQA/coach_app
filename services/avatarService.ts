import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { doc, updateDoc, deleteField } from "firebase/firestore";
import * as ImageManipulator from "expo-image-manipulator";
import { db, storage } from "../firebase/firebaseConfig";
import { logger } from "@/utils/logger";

const USERS_COLLECTION = "users";
const AVATAR_PATH = (uid: string) => `users/${uid}/avatar.jpg`;
const MAX_DIMENSION = 512;
const JPEG_QUALITY = 0.85;

export const avatarService = {
  /**
   * Compress + upload + persist URL on the user document.
   * Returns the resulting public URL (with Firebase Storage access token).
   *
   * Pass `options.flipHorizontal = true` for front-camera captures so the
   * saved photo matches what the user saw in the viewfinder (not mirrored).
   */
  async uploadAvatar(
    uid: string,
    localUri: string,
    options?: { flipHorizontal?: boolean }
  ): Promise<string> {
    // 1. Build operation list: optional horizontal flip, then resize.
    const operations: ImageManipulator.Action[] = [];
    if (options?.flipHorizontal) {
      operations.push({ flip: ImageManipulator.FlipType.Horizontal });
    }
    operations.push({ resize: { width: MAX_DIMENSION, height: MAX_DIMENSION } });

    // 2. Resize (+ optional flip) + compress
    const manipulated = await ImageManipulator.manipulateAsync(
      localUri,
      operations,
      { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG }
    );

    // 2. Fetch as blob
    const response = await fetch(manipulated.uri);
    const blob = await response.blob();

    // 3. Upload to Storage
    const ref = storageRef(storage, AVATAR_PATH(uid));
    await uploadBytes(ref, blob, { contentType: "image/jpeg" });

    // 4. Get the public download URL
    const url = await getDownloadURL(ref);

    // 5. Persist on the user document
    await updateDoc(doc(db, USERS_COLLECTION, uid), { photoURL: url });

    return url;
  },

  /** Removes the avatar object and clears photoURL on the user doc. */
  async deleteAvatar(uid: string): Promise<void> {
    const ref = storageRef(storage, AVATAR_PATH(uid));
    try {
      await deleteObject(ref);
    } catch (e: any) {
      // 'storage/object-not-found' is fine — nothing to remove.
      if (e?.code !== "storage/object-not-found") {
        logger.warn("[avatarService] deleteObject non-fatal", e);
      }
    }
    await updateDoc(doc(db, USERS_COLLECTION, uid), { photoURL: deleteField() });
  },
};
