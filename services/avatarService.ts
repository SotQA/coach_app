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
   */
  async uploadAvatar(uid: string, localUri: string): Promise<string> {
    // 1. Resize + compress
    const manipulated = await ImageManipulator.manipulateAsync(
      localUri,
      [{ resize: { width: MAX_DIMENSION, height: MAX_DIMENSION } }],
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
