import { z } from "zod";
import { VEHICLE_TYPES } from "../../utils/constants";
import { zBoolean } from "../../utils/zodHelpers";

export const createVehicleSchema = z.object({
  body: z.object({
    type: z.enum(VEHICLE_TYPES),
    registrationNumber: z.string().trim().min(2, "Registration number is required"),
    capacity: z.coerce.number().int().positive().optional(),
    driverName: z.string().trim().optional(),
    driverPhone: z.string().trim().optional(),
    isActive: zBoolean(true),
    notes: z.string().trim().optional(),
  }),
});

export const updateVehicleSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  body: createVehicleSchema.shape.body.partial(),
});
