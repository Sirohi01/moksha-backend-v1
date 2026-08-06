import { Schema, model, Document, Types } from "mongoose";
import { AssignmentStatus, ASSIGNMENT_STATUSES, AssignmentRole, ASSIGNMENT_ROLES } from "../utils/constants";

/** PRD §11.4 "volunteerAssignments" — links a Volunteer to a Case. A case can have more than one
 * active assignment (e.g. PRIMARY + DRIVER), so this is its own collection rather than a single
 * field on Case. */
export interface IVolunteerAssignment extends Document {
  _id: Types.ObjectId;
  caseId: Types.ObjectId;
  volunteerId: Types.ObjectId;
  role: AssignmentRole;
  status: AssignmentStatus;
  assignedBy: Types.ObjectId;
  note?: string;
  respondedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

const volunteerAssignmentSchema = new Schema<IVolunteerAssignment>(
  {
    caseId: { type: Schema.Types.ObjectId, ref: "Case", required: true, index: true },
    volunteerId: { type: Schema.Types.ObjectId, ref: "Volunteer", required: true, index: true },
    role: { type: String, enum: ASSIGNMENT_ROLES, default: "PRIMARY" },
    status: { type: String, enum: ASSIGNMENT_STATUSES, default: "ASSIGNED", index: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    note: { type: String, trim: true },
    respondedAt: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const VolunteerAssignment = model<IVolunteerAssignment>("VolunteerAssignment", volunteerAssignmentSchema);
