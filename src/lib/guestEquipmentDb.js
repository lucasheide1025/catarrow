import { getFunctions, httpsCallable } from "firebase/functions";
import app from "./firebase";
const functions=getFunctions(app,"asia-east1");
export async function initializeGuestEquipment(memberId){const r=await httpsCallable(functions,"initializeGuestEquipment")({memberId});return r.data;}
export async function purchaseGuestEquipment(memberId,itemId){const r=await httpsCallable(functions,"purchaseGuestEquipment")({memberId,itemId});return r.data;}
