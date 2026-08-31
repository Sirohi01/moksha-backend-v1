import { Request, Response } from "express";
import { Redirect } from "../../models/redirect.model";

export const getRedirects = async (req: Request, res: Response) => {
  try {
    const redirects = await Redirect.find().sort({ createdAt: -1 });
    res.json({ success: true, data: redirects });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createRedirect = async (req: Request, res: Response) => {
  try {
    const { source, destination, permanent, isActive } = req.body;
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
    const { source, destination, permanent, isActive } = req.body;
    const redirect = await Redirect.findByIdAndUpdate(
      id,
      { source, destination, permanent, isActive },
      { new: true, runValidators: true }
    );
    if (!redirect) return res.status(404).json({ success: false, message: "Redirect not found" });
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
    if (!redirect) return res.status(404).json({ success: false, message: "Redirect not found" });
    res.json({ success: true, data: {} });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
