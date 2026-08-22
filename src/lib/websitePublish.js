import { getFunctions, httpsCallable } from "firebase/functions";
import app from "./firebase";

const functions = getFunctions(app, "asia-east1");

export async function publishCompetitionWebsite() {
  const result = await httpsCallable(functions, "publishCompetitionWebsite")({});
  return result.data || {};
}
