import { Request, Response } from "express";
import {
  approvePairingRequest,
  createPairingRequest,
  getPairingStatus,
  listPairingRequests,
  rejectPairingRequest,
} from "./pairing.service";

function getUserId(req: Request): string {
  const user = (req as any).user;

  const id = user?.id ?? user?.userId ?? user?.sub;

  if (!id) {
    throw new Error("AUTH_USER_ID_MISSING");
  }

  return String(id);
}

export async function requestPairing(req: Request, res: Response) {
  try {
    const result = await createPairingRequest({
      hostname: req.body?.hostname,
      friendlyName: req.body?.friendlyName,
      launcherVersion: req.body?.launcherVersion,
    });

    return res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Pairing request error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create pairing request",
    });
  }
}

export async function pairingStatus(req: Request, res: Response) {
  try {
    const pairingId = String(req.body?.pairingId ?? "");
    const pairingSecret = String(req.body?.pairingSecret ?? "");

    if (!pairingId || !pairingSecret) {
      return res.status(400).json({
        success: false,
        message: "pairingId and pairingSecret are required",
      });
    }

    const result = await getPairingStatus({
      pairingId,
      pairingSecret,
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    const message = error?.message;

    if (
      message === "PAIRING_NOT_FOUND" ||
      message === "INVALID_PAIRING_SECRET"
    ) {
      return res.status(404).json({
        success: false,
        message: "Invalid pairing request",
      });
    }

    if (message === "PAIRING_ALREADY_CONSUMED") {
      return res.status(409).json({
        success: false,
        message: "Pairing has already been consumed",
      });
    }

    console.error("Pairing status error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to check pairing status",
    });
  }
}

export async function adminListPairings(
  req: Request,
  res: Response,
) {
  try {
    const requests = await listPairingRequests();

    return res.json({
      success: true,
      data: requests,
    });
  } catch (error) {
    console.error("List pairing requests error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load pairing requests",
    });
  }
}

export async function adminApprovePairing(
  req: Request,
  res: Response,
) {
  try {
    const pairingId = String(req.params.id);

    const device = await approvePairingRequest(
      pairingId,
      getUserId(req),
    );

    return res.json({
      success: true,
      message: "Device pairing approved",
      data: {
        device,
      },
    });
  } catch (error: any) {
    const message = error?.message;

    if (message === "PAIRING_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Pairing request not found",
      });
    }

    if (
      message === "PAIRING_NOT_PENDING" ||
      message === "PAIRING_EXPIRED"
    ) {
      return res.status(409).json({
        success: false,
        message,
      });
    }

    console.error("Approve pairing error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to approve pairing request",
    });
  }
}

export async function adminRejectPairing(
  req: Request,
  res: Response,
) {
  try {
    const pairingId = String(req.params.id);

    await rejectPairingRequest(pairingId);

    return res.json({
      success: true,
      message: "Device pairing rejected",
    });
  } catch (error: any) {
    const message = error?.message;

    if (message === "PAIRING_NOT_PENDING") {
      return res.status(409).json({
        success: false,
        message,
      });
    }

    console.error("Reject pairing error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to reject pairing request",
    });
  }
}