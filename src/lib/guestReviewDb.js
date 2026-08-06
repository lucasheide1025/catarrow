import { getFunctions, httpsCallable } from "firebase/functions";
import app from "./firebase";

const functions = getFunctions(app, "asia-east1");
const call = async (name, data = {}) => (await httpsCallable(functions, name)(data)).data;
export const previewGuestReview = token => call("previewGuestReview", { token });
export const submitGuestReviewByToken = (token, review) => call("submitGuestReviewByToken", { token, ...review });
export const getMyGuestReview = () => call("getMyGuestReview");
export const submitMyGuestReview = review => call("submitMyGuestReview", review);
export const withdrawGuestReviewPublication = () => call("withdrawGuestReviewPublication");
export const adminGuestReviewAction = data => call("adminGuestReviewAction", data);
export const sendGuestReviewComplaintReply = data => call("sendGuestReviewComplaintReply", data);
export const saveGuestReviewConfig = data => call("saveGuestReviewConfig", data);
