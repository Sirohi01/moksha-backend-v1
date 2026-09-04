import { Request, Response } from "express";
import { Redirect } from "../../models/redirect.model";

function normalizeRedirectPath(value: unknown, field: string, allowQuery: boolean): string {
  if (typeof value !== "string") throw new Error(`${field} must be a path`);
  const path = value.trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\") || /[\r\n]/.test(path)) {
    throw new Error(`${field} must be a safe same-site path beginning with /`);
  }
  const parsed = new URL(path, "https://mokshasewa.org");
  if (parsed.origin !== "https://mokshasewa.org") throw new Error(`${field} must stay on this site`);
  if (!allowQuery && parsed.search) throw new Error(`${field} cannot contain a query string`);
  return `${parsed.pathname}${parsed.search}`;
}

async function validateRedirect(sourceValue: unknown, destinationValue: unknown, excludeId?: string) {
  const source = normalizeRedirectPath(sourceValue, "source", false);
  const destination = normalizeRedirectPath(destinationValue, "destination", true);
  if (source === destination) throw new Error("Source and destination cannot be the same");
  const reverse = await Redirect.findOne({ source: destination, destination: source, ...(excludeId ? { _id: { $ne: excludeId } } : {}) });
  if (reverse) throw new Error("This redirect would create a loop");
  return { source, destination };
}

export const getRedirects = async (_req: Request, res: Response) => {
  try {
    const redirects = await Redirect.find().sort({ createdAt: -1 });
    res.json({ success: true, data: redirects });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createRedirect = async (req: Request, res: Response) => {
  try {
    const { permanent, isActive } = req.body;
    const { source, destination } = await validateRedirect(req.body.source, req.body.destination);
    const redirect = await Redirect.create({ source, destination, permanent, isActive });
    res.status(201).json({ success: true, data: redirect });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({ success: false, message: "A redirect for this source already exists." });
    } else {
      res.status(400).json({ success: false, message: error.message });
    }
  }
};

export const updateRedirect = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { permanent, isActive } = req.body;
    const { source, destination } = await validateRedirect(req.body.source, req.body.destination, id);
    const redirect = await Redirect.findByIdAndUpdate(
      id,
      { source, destination, permanent, isActive },
      { new: true, runValidators: true }
    );
    if (!redirect) {
      res.status(404).json({ success: false, message: "Redirect not found" });
      return;
    }
    res.json({ success: true, data: redirect });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({ success: false, message: "A redirect for this source already exists." });
    } else {
      res.status(400).json({ success: false, message: error.message });
    }
  }
};

export const deleteRedirect = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const redirect = await Redirect.findByIdAndDelete(id);
    if (!redirect) {
      res.status(404).json({ success: false, message: "Redirect not found" });
      return;
    }
    res.json({ success: true, data: {} });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
