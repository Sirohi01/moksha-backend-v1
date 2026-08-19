import mongoose from "mongoose";
import { User, IUser } from "../../models/user.model";
import { Volunteer, IVolunteer } from "../../models/volunteer.model";
import { VolunteerAssignment } from "../../models/volunteerAssignment.model";
import { Case } from "../../models/case.model";
import { CaseDocument } from "../../models/caseDocument.model";
import { AssistanceRequest } from "../../models/assistanceRequest.model";
import { CaseTimeline } from "../../models/caseTimeline.model";
import { Role } from "../../models/role.model";
import { ApiError } from "../../utils/ApiError";
import { env } from "../../config/env";
import { hashPassword } from "../../lib/password.service";
import { issueTokenPair, DeviceInfo } from "../../lib/session.service";
import { notify } from "../../lib/notify.service";
import { writeAuditLog } from "../../lib/audit.service";
import { uploadBuffer } from "../../lib/cloudinary";
import { notifyAdmins } from "../../lib/adminNotify.service";
import { geocodeAddress } from "../../lib/geocoding";
import { generateVolunteerCode } from "../../lib/counter.service";
import { logger } from "../../config/logger";
import {
  VolunteerStatus,
  VolunteerAvailability,
  VolunteerGender,
  VolunteerBloodGroup,
  VolunteerSchedulePreference,
  VolunteerPreferredRole,
  DocumentType,
  ACTIVE_ASSIGNMENT_STATUSES,
} from "../../utils/constants";
import { compactFilter } from "../../utils/compactFilter";
import { decryptField, maybeDecrypt } from "../../lib/crypto";
import { PaginationParams, buildMeta } from "../../utils/pagination";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import PDFDocument from "pdfkit";

interface RegisterVolunteerInput {
  name: string;
  phone: string;
  email: string;
  password: string;
  city: string;
  skills: string[];
  dateOfBirth?: Date;
  gender?: VolunteerGender;
  bloodGroup?: VolunteerBloodGroup;
  address?: string;
  state?: string;
  pincode?: string;
  motivation?: string;
  experience?: string;
  schedulePreference?: VolunteerSchedulePreference;
  preferredRole?: VolunteerPreferredRole;
  whatsappPhone?: string; occupation?: string; organisation?: string;
  volunteerAreas?: string[]; availabilityDays?: string[]; preferredTimes?: string[];
  emergencyOnCall?: boolean; canParticipateFieldCases?: boolean; ownVehicle?: boolean;
  languagesKnown?: string; hoursPerWeek?: string; volunteeredBefore?: boolean;
  previousOrganisationRole?: string;
  emergencyContact?: { name?: string; relationship?: string; phone?: string };
  idProofType?: string; idProofNumber?: string; declarationAccepted?: true;
  photographUrl?: string; photographPublicId?: string; idProofUrl?: string; idProofPublicId?: string;
}
function geocodeVolunteerAsync(volunteerId: string, location: { address?: string; city: string; state?: string; pincode?: string }): void {
  const query = [location.address, location.city, location.state, location.pincode, "India"].filter(Boolean).join(", ");
  geocodeAddress(query)
    .then((coords) => {
      if (!coords) return;
      return Volunteer.findByIdAndUpdate(volunteerId, { lat: coords.lat, lng: coords.lng });
    })
    .catch((err) => logger.error("geocodeVolunteerAsync(): background geocoding failed", { err, volunteerId }));
}
export async function registerVolunteer(input: RegisterVolunteerInput, deviceInfo?: DeviceInfo) {
  const existing = await User.findOne({ $or: [{ phone: input.phone }, { email: input.email }] });
  if (existing) throw ApiError.conflict("An account with this phone or email already exists");

  const volunteerRole = await Role.findOne({ slug: "volunteer" }).select("_id");
  const passwordHash = await hashPassword(input.password);

  const session = await mongoose.startSession();
  let user: IUser;
  let volunteer: IVolunteer;
  try {
    await session.withTransaction(async () => {
      const createdUsers = await User.create(
        [
          {
            name: input.name,
            phone: input.phone,
            email: input.email,
            passwordHash,
            userType: "VOLUNTEER",
            roleId: volunteerRole?._id,
            lastLoginAt: new Date(),
          },
        ],
        { session }
      );
      user = createdUsers[0];

      // Sequence generation deliberately sits outside strict transactional atomicity — same
      // reasoning as generateCaseId(): a gap on abort is fine, reuse is not, and the atomic $inc
      // in getNextSequence already guarantees the latter on its own.
      const code = await generateVolunteerCode();
      const createdVolunteers = await Volunteer.create(
        [
          {
            userId: user._id,
            code,
            city: input.city,
            skills: input.skills,
            dateOfBirth: input.dateOfBirth,
            gender: input.gender,
            bloodGroup: input.bloodGroup,
            address: input.address,
            state: input.state,
            pincode: input.pincode,
            motivation: input.motivation,
            experience: input.experience,
            schedulePreference: input.schedulePreference,
            preferredRole: input.preferredRole,
            whatsappPhone: input.whatsappPhone,
            occupation: input.occupation,
            organisation: input.organisation,
            volunteerAreas: input.volunteerAreas ?? [],
            availabilityDays: input.availabilityDays ?? [],
            preferredTimes: input.preferredTimes ?? [],
            emergencyOnCall: input.emergencyOnCall,
            canParticipateFieldCases: input.canParticipateFieldCases,
            ownVehicle: input.ownVehicle,
            languagesKnown: input.languagesKnown,
            hoursPerWeek: input.hoursPerWeek,
            volunteeredBefore: input.volunteeredBefore,
            previousOrganisationRole: input.previousOrganisationRole,
            emergencyContact: input.emergencyContact,
            idProofType: input.idProofType,
            idProofNumber: input.idProofNumber,
            declarationAccepted: input.declarationAccepted,
            photographUrl: input.photographUrl,
            photographPublicId: input.photographPublicId,
            idProofUrl: input.idProofUrl,
            idProofPublicId: input.idProofPublicId,
          },
        ],
        { session }
      );
      volunteer = createdVolunteers[0];
    });
  } finally {
    await session.endSession();
  }

  await notify("volunteer.registered", { userId: user!._id.toString(), email: user!.email }, {
    name: input.name,
    city: input.city,
  });

  geocodeVolunteerAsync(volunteer!._id.toString(), { address: input.address, city: input.city, state: input.state, pincode: input.pincode });

  const { accessToken, refreshToken } = await issueTokenPair(user!._id.toString(), env.JWT_REFRESH_EXPIRY, deviceInfo);
  const volunteerObj = volunteer!.toObject();
  if (volunteerObj.address) volunteerObj.address = decryptField(volunteerObj.address);

  return { user: user!, volunteer: volunteerObj, accessToken, refreshToken };
}

export async function listVolunteersForAdmin(
  filter: { status?: VolunteerStatus; city?: string },
  pagination?: PaginationParams
) {
  const mongoFilter = compactFilter(filter);
  const query = Volunteer.find(mongoFilter).sort({ createdAt: -1 });
  if (pagination?.requested) query.skip(pagination.skip).limit(pagination.limit);

  const [volunteers, total] = await Promise.all([
    query,
    pagination?.requested ? Volunteer.countDocuments(mongoFilter) : Promise.resolve(undefined),
  ]);
  const approverIds = volunteers.map((v) => v.approvedByUserId).filter((id): id is mongoose.Types.ObjectId => Boolean(id));
  const [users, approvers] = await Promise.all([
    User.find({ _id: { $in: volunteers.map((v) => v.userId) } }).select("name phone email"),
    approverIds.length ? User.find({ _id: { $in: approverIds } }).select("name") : Promise.resolve([]),
  ]);
  const userById = new Map(users.map((u) => [u._id.toString(), u]));
  const approverNameById = new Map(approvers.map((u) => [u._id.toString(), u.name]));

  const items = volunteers.map((v) => {
    const u = userById.get(v.userId.toString());
    const obj = v.toObject();
    return {
      ...obj,
      address: obj.address ? maybeDecrypt(obj.address) : obj.address,
      name: u?.name,
      phone: u?.phone,
      email: u?.email,
      approvedByName: v.approvedByUserId ? approverNameById.get(v.approvedByUserId.toString()) : undefined,
    };
  });
  const meta = pagination?.requested ? buildMeta(pagination.page, pagination.limit, total!) : undefined;
  return { volunteers: items, meta };
}

async function getVolunteerWithUser(volunteerId: string) {
  const volunteer = await Volunteer.findById(volunteerId);
  if (!volunteer) throw ApiError.notFound("Volunteer not found");
  const [user, approvedByUser] = await Promise.all([
    User.findById(volunteer.userId).select("name phone email"),
    volunteer.approvedByUserId ? User.findById(volunteer.approvedByUserId).select("name") : Promise.resolve(null),
  ]);
  const obj = volunteer.toObject();
  return {
    ...obj,
    address: obj.address ? maybeDecrypt(obj.address) : obj.address,
    name: user?.name,
    phone: user?.phone,
    email: user?.email,
    approvedByName: approvedByUser?.name,
    // Falls back to the registration date so the printed form always has a joining date even
    // when an admin hasn't explicitly overridden it (PRD ask: "the day they filled the form is
    // the joining date unless we set it separately").
    joiningDate: obj.joiningDate ?? obj.createdAt,
  };
}

export const getVolunteerForAdmin = getVolunteerWithUser;

/** Removes a volunteer's profile and their login account together — leaving the Volunteer profile
 * deleted but the User account behind would orphan a VOLUNTEER-type login with no profile to
 * resolve (findMyVolunteerProfile would 404 on every self-service call). Blocked while the
 * volunteer still has a live case assignment so deleting them can't silently strand a case. */
export async function deleteVolunteer(volunteerId: string, actorUserId: string): Promise<void> {
  const volunteer = await Volunteer.findById(volunteerId);
  if (!volunteer) throw ApiError.notFound("Volunteer not found");

  const hasActiveAssignment = await VolunteerAssignment.exists({
    volunteerId: volunteer._id,
    status: { $in: ACTIVE_ASSIGNMENT_STATUSES },
  });
  if (hasActiveAssignment) {
    throw ApiError.conflict(
      "This volunteer has an active case assignment. Withdraw or resolve it before deleting their profile."
    );
  }

  await Volunteer.deleteOne({ _id: volunteer._id });
  await User.deleteOne({ _id: volunteer.userId });

  await writeAuditLog({
    userId: actorUserId,
    action: "volunteer.deleted",
    entityType: "Volunteer",
    entityId: volunteer._id.toString(),
    before: volunteer.toObject(),
  });
}

/** Admin-managed "For Office Use Only" fields — printed on the registration form. approvedBy is
 * deliberately never client-settable: it's stamped with the acting admin's own account the moment
 * they mark a volunteer verified, and cleared if verification is revoked, so it can't be spoofed
 * or left stale. */
export async function updateVolunteerOfficeUse(
  volunteerId: string,
  input: { verified?: boolean; assignedRole?: string; assignedArea?: string; joiningDate?: Date | null },
  actorUserId: string
) {
  const volunteer = await Volunteer.findById(volunteerId);
  if (!volunteer) throw ApiError.notFound("Volunteer not found");

  if (input.assignedRole !== undefined) volunteer.assignedRole = input.assignedRole || undefined;
  if (input.assignedArea !== undefined) volunteer.assignedArea = input.assignedArea || undefined;
  if (input.joiningDate !== undefined) volunteer.joiningDate = input.joiningDate ?? undefined;

  if (input.verified !== undefined && input.verified !== volunteer.verified) {
    volunteer.verified = input.verified;
    if (input.verified) {
      volunteer.approvedByUserId = new mongoose.Types.ObjectId(actorUserId);
      volunteer.approvedAt = new Date();
    } else {
      volunteer.approvedByUserId = undefined;
      volunteer.approvedAt = undefined;
    }
  }

  await volunteer.save();

  await writeAuditLog({
    userId: actorUserId,
    action: "volunteer.office_use_updated",
    entityType: "Volunteer",
    entityId: volunteer._id.toString(),
    after: {
      verified: volunteer.verified,
      assignedRole: volunteer.assignedRole,
      assignedArea: volunteer.assignedArea,
      joiningDate: volunteer.joiningDate,
    },
  });

  return getVolunteerWithUser(volunteerId);
}
const volunteerPrintHeader = `data:image/png;base64,${readFileSync(join(process.cwd(), "assets", "volunteer-print-header.png")).toString("base64")}`;


const escapeHtml = (value: unknown) => String(value ?? "—").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]!));

export async function getVolunteerPrintHtml(volunteerId: string) {
  const v: any = await getVolunteerWithUser(volunteerId);
  return renderVolunteerPrintHtml(v);
}

export function renderVolunteerPrintHtml(v: any) {
  const yesNo = (value?: boolean) => value === undefined ? "—" : value ? "Yes" : "No";
  const list = (value?: string[]) => value?.length ? value.map(escapeHtml).join(", ") : "—";
  const row = (label: string, value: unknown) => `<div class="field"><b>${label}</b><span>${escapeHtml(value)}</span></div>`;
  const options = (all: string[], selected: string[] = []) => all.map((item) => `<span style="display:block;margin:3px 0;color:#111"><i style="display:inline-grid;place-items:center;width:10px;height:10px;border:1px solid #8993a2;font-style:normal;margin-right:4px">${selected.includes(item) ? "✓" : ""}</i>${escapeHtml(item)}</span>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Volunteer Registration - ${escapeHtml(v.name)}</title><style>
  @page{size:A4 portrait;margin:3mm}*{box-sizing:border-box}html,body{margin:0;padding:0}body{font-family:Arial,sans-serif;color:#142650;background:#fff;font-size:7px;-webkit-print-color-adjust:exact;print-color-adjust:exact}.sheet{width:204mm;height:291mm;overflow:hidden;border:1px solid #b8c3d8}.hero{height:42mm;text-align:center;padding:3mm 50mm 1mm;border-bottom:1px solid #e85013;background-image:url('${volunteerPrintHeader}');background-size:cover;background-position:center}.hero>div:first-child{display:inline-block;border:1px solid #e3a326;border-radius:10px;background:#fff7df;padding:2px 16px;font-weight:700;color:#111}h1{font-family:Georgia,serif;font-size:27px;line-height:1;letter-spacing:2px;color:#5b0a0a;margin:7px 0 1px}.subtitle{font-size:14px;font-weight:900;color:#e5460a}.tag{color:#5b1515;font-size:11px;margin-top:2px}.section{margin:2px 6px;border:1px solid var(--c);border-radius:6px;overflow:hidden;break-inside:avoid}.section h2{margin:0;padding:3px 8px;color:white;background:var(--c);font-size:8px}.grid{display:grid;grid-template-columns:repeat(2,1fr)}.grid.three{grid-template-columns:repeat(3,1fr)}.field{min-height:18px;padding:3px 6px;border-right:1px solid #ccd3df;border-bottom:1px solid #ccd3df}.field b{display:block;font-size:6px;margin-bottom:1px}.field span{color:#171717}.wide{grid-column:1/-1}.orange{--c:#e9500e}.blue{--c:#133d7a}.green{--c:#417b1d}.purple{--c:#51228a}.teal{--c:#087889}.red{--c:#681414}.declaration{line-height:1.25;padding:5px;color:#222;font-size:6px}.footer{margin:2px 6px;background:#6e0c0c;color:#fff;padding:5px 10px;border-radius:4px;font-size:9px;font-weight:semibold;display:flex;justify-content:space-between}@media screen{body{background:#ddd;padding:10px}.sheet{margin:auto;background:#fff;box-shadow:0 3px 15px #777}}@media print{body{padding:0}.sheet{border:0}button{display:none}}
  .sheet{display:grid;grid-template-columns:repeat(6,1fr);grid-template-rows:42mm 43mm 53mm 49mm 47mm 23mm 12mm;gap:1.5mm;padding-bottom:1mm}.hero{grid-column:1/-1}.sheet>section:nth-of-type(1){grid-column:1/-1}.sheet>section:nth-of-type(2){grid-column:1/4;grid-row:3/5}.sheet>section:nth-of-type(3){grid-column:4/-1;grid-row:3}.sheet>section:nth-of-type(4){grid-column:4/-1;grid-row:4}.sheet>section:nth-of-type(5){grid-column:1/3;grid-row:5}.sheet>section:nth-of-type(6){grid-column:3/5;grid-row:5}.sheet>section:nth-of-type(7){grid-column:5/-1;grid-row:5}.sheet>section:nth-of-type(8){grid-column:1/-1;grid-row:6}.sheet>.footer{grid-column:1/-1;grid-row:7;margin:0 3px}.sheet>.section{margin:0 3px}.sheet>section:nth-of-type(1) .field{min-height:8mm;padding:2mm 2.5mm}.sheet>section:nth-of-type(1) .field b{display:inline;font-size:7px;margin-right:2mm}.sheet>section:nth-of-type(2) span[style*="display:block"]{margin:5px 0!important;font-size:7.5px}.sheet>section:nth-of-type(2)>div>b{font-size:8px}.sheet>section:nth-of-type(3) .field{min-height:9mm;padding:1.8mm 2mm}.sheet>section:nth-of-type(4) .field{min-height:9.5mm;padding:1.8mm 2mm}.sheet>section:nth-of-type(5) .field,.sheet>section:nth-of-type(6) .field{min-height:11mm;padding:2mm}.sheet>section:nth-of-type(7) .declaration{font-size:7px;line-height:1.42;padding:2mm}.section h2{font-size:9px!important;padding:4px 9px!important}.field b{font-size:7px}.field span{font-size:7.5px}.office-grid{display:grid;grid-template-columns:repeat(5,1fr)}.office-grid .field{min-height:7mm;text-align:center;padding:1.5mm}.hero>div:last-child{font-size:7.5px!important;line-height:1.3}.footer{font-size:8px}
  </style></head><body><div class="sheet"><div class="hero"><div>An Initiative by Namo Gange Trust</div><h1>MOKSHA SEWA</h1><div class="subtitle">VOLUNTEER REGISTRATION FORM</div><div class="tag">सेवा • सम्मान • अंतिम गरिमा</div><div style="margin-top:2px;color:#111">Join hands in our mission to provide dignified last rites<br>and end-of-life support to the unclaimed and the needy.</div></div>
  <section class="section blue"><h2>A. PERSONAL DETAILS</h2><div class="grid three">${row("Full Name", v.name)}${row("Date of Birth", v.dateOfBirth ? new Date(v.dateOfBirth).toLocaleDateString("en-IN") : "—")}${row("Gender", v.gender)}${row("Mobile No.", v.phone)}${row("WhatsApp No.", v.whatsappPhone)}${row("Email ID", v.email)}${row("City / District", v.city)}${row("State", v.state)}${row("PIN Code", v.pincode)}${row("Occupation / Profession", v.occupation)}${row("Organisation / Institution", v.organisation)}${row("Address", v.address)}</div></section>
  <section class="section orange"><h2>B. HOW WOULD YOU LIKE TO SERVE?</h2><div style="padding:5px 8px"><b style="color:#e9500e">Preferred Area of Volunteering</b>${options(["Field Volunteer", "Hospital & Authority Coordination", "Cremation & Ritual Assistance", "Unclaimed Body Support", "Economically Weaker Family Support", "24×7 Helpline Support", "Ambulance / Logistics Support", "Documentation & Case Support", "Community Awareness", "Social Media / Digital Volunteering", "Photography / Videography / Content", "Fundraising & Donor Outreach", "Professional / Pro-Bono Support", "Events & Campaign Support"], v.volunteerAreas)}<div style="border-top:1px solid #ccc;padding-top:3px"><b>Preferred Role:</b> ${escapeHtml(v.preferredRole)}</div></div></section>
  <section class="section blue"><h2>C. AVAILABILITY</h2><div class="grid three">${row("Availability", list(v.availabilityDays))}${row("Preferred Time", list(v.preferredTimes))}${row("Schedule", v.schedulePreference)}${row("Emergency / On-Call Seva", yesNo(v.emergencyOnCall))}${row("Can Participate in Field Cases", yesNo(v.canParticipateFieldCases))}${row("Own Vehicle Available", yesNo(v.ownVehicle))}${row("Languages Known", v.languagesKnown)}${row("Approx. Hours / Week", v.hoursPerWeek)}</div></section>
  <section class="section green"><h2>D. SKILLS & EXPERIENCE</h2><div class="grid">${row("Relevant Skills", list(v.skills))}${row("Volunteered with NGO / Social Organisation", yesNo(v.volunteeredBefore))}${row("Organisation & Role", v.previousOrganisationRole)}${row("Why join Moksha Sewa?", v.motivation)}${row("Experience", v.experience)}</div></section>
  <section class="section purple"><h2>E. EMERGENCY CONTACT</h2><div class="grid three">${row("Contact Person", v.emergencyContact?.name)}${row("Relationship", v.emergencyContact?.relationship)}${row("Mobile No.", v.emergencyContact?.phone)}</div></section>
  <section class="section teal"><h2>F. IDENTITY VERIFICATION</h2><div class="grid">${row("ID Proof Type", v.idProofType)}${row("ID Proof No.", v.idProofNumber)}${row("ID Proof Attachment", v.idProofUrl ? "Attached in admin record" : "Not attached")}</div></section>
  <section class="section red"><h2>G. VOLUNTEER DECLARATION</h2><div class="declaration">I voluntarily wish to associate with Moksha Sewa for humanitarian and social service. I agree to follow Moksha Sewa's policies, code of conduct, confidentiality requirements, safety instructions and directions of authorised coordinators. I will maintain dignity, privacy and religious/cultural sensitivity. <b>${v.declarationAccepted ? "Declaration accepted by applicant." : "Declaration not accepted."}</b><br><br>Applicant Signature: ____________________ &nbsp; Date: ${new Date(v.createdAt).toLocaleDateString("en-IN")}</div></section>
  <section class="section orange"><h2>▣ &nbsp; FOR OFFICE USE ONLY</h2><div class="office-grid">${row("Volunteer ID", v._id)}${row("Verification", "☐ Verified")}${row("Assigned Role", "")}${row("Assigned Area", "")}${row("Status", v.status)}${row("Approved By", "")}${row("Joining / Orientation Date", "")}</div></section>
  <div class="footer"><span>☎ &nbsp; 24×7 ASSISTANCE HELPLINE: 9654900525</span><span>सेवा से जुड़ें, अंतिम यात्रा को सम्मान और गरिमा दें।</span></div></div><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),400))</script></body></html>`;
}

export async function getVolunteerPdf(volunteerId: string): Promise<Buffer> {
  const v: any = await getVolunteerWithUser(volunteerId);
  return renderVolunteerPdf(v);
}
export function renderVolunteerPdf(v: any): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 18, bufferPages: true, info: { Title: `Moksha Sewa Volunteer - ${v.name}` } });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  const done = new Promise<Buffer>((resolve, reject) => { doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject); });
  const W = 559, x = 18;
  const colors = { blue: "#123d7a", orange: "#ea4e0b", green: "#417817", purple: "#502287", teal: "#087789", red: "#681313", brown: "#92520d" };

  // ---- Header ----
  // The banner image now has the logo, title, subtitle and tagline baked into it directly — no
  // vector text/logo overlay needed on top. Height is derived from the image's own aspect ratio
  // (rather than an arbitrary fixed height) so the baked-in typography isn't stretched.
  const headerImage = join(process.cwd(), "assets", "volunteer-print-header.png");
  const headerNaturalH = Math.round(W * (724 / 2172)); // ~186 at true aspect ratio
  // A few points shy of the true aspect ratio (~7%) — the exact ratio pushes the rest of the form
  // past one A4 page even after tightening every section below; this is a small enough trim that
  // the baked-in banner text is still effectively undistorted.
  const headerH = headerNaturalH - 14;
  doc.image(headerImage, x, 18, { width: W, height: headerH });

  const section = (sx: number, sy: number, sw: number, sh: number, color: string, title: string) => { doc.roundedRect(sx, sy, sw, sh, 6).lineWidth(.7).strokeColor(color).stroke(); doc.roundedRect(sx, sy, Math.min(sw, 230), 15, 6).fillColor(color).fill(); doc.rect(sx, sy + 8, Math.min(sw, 230), 7).fill(); doc.font("Helvetica-Bold").fontSize(7.2).fillColor("white").text(title, sx + 7, sy + 4, { width: sw - 14 }); };
  const text = (label: string, value: unknown, tx: number, ty: number, tw: number, opts?: { height?: number; ellipsis?: boolean }) => {
    const h = opts?.height ?? 15, ell = opts?.ellipsis ?? true;
    doc.font("Helvetica-Bold").fontSize(5.6).fillColor("#102650").text(label, tx, ty, { width: tw });
    doc.font("Helvetica").fontSize(6.3).fillColor("#111").text(String(value ?? "—") || "—", tx, ty + 7, { width: tw, height: h, ellipsis: ell });
  };
  const grid = (items: [string, unknown][], gx: number, gy: number, gw: number, cols: number, rowH: number, opts?: { height?: number; ellipsis?: boolean }) =>
    items.forEach(([l, val], i) => { const cw = gw / cols, c = i % cols, r = Math.floor(i / cols), px = gx + c * cw, py = gy + r * rowH; doc.rect(px, py, cw, rowH).lineWidth(.25).strokeColor("#bbc4d1").stroke(); text(l, val, px + 5, py + 4, cw - 10, opts); });
  // Vector checkmark, not a font glyph — pdfkit's built-in Helvetica can't encode "✓" (it
  // silently prints garbage for it), and a drawn mark is trivially centered inside its own box
  // instead of depending on font-metric guesswork.
  const checkbox = (bx: number, by: number, checked: boolean) => {
    doc.rect(bx, by, 7, 7).lineWidth(.6).strokeColor("#68758a").stroke();
    if (checked) { doc.save(); doc.lineWidth(1.1).strokeColor(colors.orange).moveTo(bx + 1.4, by + 3.8).lineTo(bx + 3, by + 5.6).lineTo(bx + 5.8, by + 1.4).stroke(); doc.restore(); }
  };

  // ---- A. Personal details ----
  const aY = 18 + headerH + 9;
  const aItems: [string, unknown][] = [
    ["Full Name*", v.name], ["Date of Birth", v.dateOfBirth ? new Date(v.dateOfBirth).toLocaleDateString("en-IN") : "—"],
    ["Gender", v.gender], ["Blood Group", v.bloodGroup], ["Mobile No.*", v.phone], ["WhatsApp No.", v.whatsappPhone],
    ["Email ID", v.email], ["City / District*", v.city], ["State*", v.state], ["PIN Code", v.pincode],
    ["Occupation / Profession", v.occupation], ["Organisation / Institution", v.organisation],
  ];
  const aCols = 3, aRowH = 24, aGridH = Math.ceil(aItems.length / aCols) * aRowH; // 12 items -> 4 rows, no remainder
  const addrRowH = 28;
  const aH = 15 + aGridH + addrRowH;
  section(x, aY, W, aH, colors.blue, "A. PERSONAL DETAILS");
  grid(aItems, x, aY + 15, W, aCols, aRowH);
  const addrY = aY + 15 + aGridH;
  doc.rect(x, addrY, W, addrRowH).lineWidth(.25).strokeColor("#bbc4d1").stroke();
  doc.font("Helvetica-Bold").fontSize(5.6).fillColor("#102650").text("Address", x + 6, addrY + 4, { width: W - 12 });
  doc.font("Helvetica").fontSize(6.3).fillColor("#111").text(v.address || "—", x + 6, addrY + 11, { width: W - 12, height: 20 });

  // ---- B/C row ----
  const row2Y = aY + aH + 5;
  const bW = 272, cGap = 6, cX = x + bW + cGap, cW = W - bW - cGap;

  const cRowH = 24, cH = 15 + 4 * cRowH;
  section(cX, row2Y, cW, cH, colors.blue, "C. AVAILABILITY");
  grid([
    ["Availability", (v.availabilityDays || []).join(", ")], ["Preferred Time", (v.preferredTimes || []).join(", ")],
    ["Schedule", v.schedulePreference], ["Emergency / On-Call", v.emergencyOnCall ? "Yes" : "No"],
    ["Field Cases", v.canParticipateFieldCases ? "Yes" : "No"], ["Own Vehicle", v.ownVehicle ? "Yes" : "No"],
    ["Languages", v.languagesKnown], ["Hours / Week", v.hoursPerWeek],
  ], cX, row2Y + 15, cW, 2, cRowH);

  // "Why join" / "Experience" are free-text answers that can run to a full paragraph — a
  // half-width grid cell isn't enough room, so they each get their own full-width wrapped row
  // below the compact 2-col grid (same pattern as the Address row in section A).
  const dGridItems: [string, unknown][] = [
    ["Relevant Skills", (v.skills || []).join(", ")], ["Volunteered with NGO", v.volunteeredBefore ? "Yes" : "No"],
    ["Organisation & Role", v.previousOrganisationRole],
  ];
  const dGridRowH = 22, dGridRows = Math.ceil(dGridItems.length / 2), dGridH = dGridRows * dGridRowH;
  const dWideRowH = 40;
  const dY = row2Y + cH + 5, dH = 15 + dGridH + dWideRowH * 2;
  section(cX, dY, cW, dH, colors.green, "D. SKILLS & EXPERIENCE");
  grid(dGridItems, cX, dY + 15, cW, 2, dGridRowH);
  const motivY = dY + 15 + dGridH;
  doc.rect(cX, motivY, cW, dWideRowH).lineWidth(.25).strokeColor("#bbc4d1").stroke();
  text("Why join Moksha Sewa?", v.motivation, cX + 5, motivY + 4, cW - 10, { height: dWideRowH - 9, ellipsis: false });
  const expY = motivY + dWideRowH;
  doc.rect(cX, expY, cW, dWideRowH).lineWidth(.25).strokeColor("#bbc4d1").stroke();
  text("Experience", v.experience, cX + 5, expY + 4, cW - 10, { height: dWideRowH - 9, ellipsis: false });

  const bH = dY + dH - row2Y; // bottom-align B with D regardless of either one's exact height
  section(x, row2Y, bW, bH, colors.orange, "B. HOW WOULD YOU LIKE TO SERVE?");
  doc.font("Helvetica-Bold").fontSize(6.5).fillColor(colors.orange).text("Preferred Area of Volunteering", x + 8, row2Y + 18);
  const service = ["Field Volunteer", "Hospital & Authority Coordination", "Cremation & Ritual Assistance", "Unclaimed Body Support", "Economically Weaker Family Support", "24x7 Helpline Support", "Ambulance / Logistics Support", "Documentation & Case Support", "Community Awareness", "Social Media / Digital Volunteering", "Photography / Videography / Content", "Fundraising & Donor Outreach", "Professional / Pro-Bono Support", "Events & Campaign Support"];
  const checkRowH = 13;
  const checkTop = row2Y + 32;
  service.forEach((s, i) => {
    const by = checkTop + i * checkRowH;
    checkbox(x + 9, by, (v.volunteerAreas || []).includes(s));
    doc.font("Helvetica").fontSize(6.1).fillColor("#111").text(s, x + 21, by - 1, { width: 240 });
  });
  text("Preferred Role", v.preferredRole, x + 9, checkTop + service.length * checkRowH + 4, 250);

  // ---- E/F/G row ----
  const row3Y = dY + dH + 6, bh3 = 112;
  section(x, row3Y, 175, bh3, colors.purple, "E. EMERGENCY CONTACT");
  grid([["Contact Person", v.emergencyContact?.name], ["Relationship", v.emergencyContact?.relationship], ["Mobile No.", v.emergencyContact?.phone]], x, row3Y + 15, 175, 1, 30);
  section(199, row3Y, 175, bh3, colors.teal, "F. IDENTITY VERIFICATION");
  grid([
    ["ID Proof Type", v.idProofType], ["ID Proof No.", v.idProofNumber],
    ["Attachments", `Photo: ${v.photographUrl ? "Yes" : "No"}   ID Proof: ${v.idProofUrl ? "Yes" : "No"}`],
  ], 199, row3Y + 15, 175, 1, 30);
  section(380, row3Y, 197, bh3, colors.red, "G. VOLUNTEER DECLARATION");
  doc.font("Helvetica").fontSize(5.7).fillColor("#111").text("I voluntarily wish to associate with Moksha Sewa for humanitarian and social service. I agree to follow its policies, code of conduct, confidentiality, safety instructions and authorised coordinators, and to maintain dignity, privacy and religious/cultural sensitivity.", 387, row3Y + 20, { width: 183, lineGap: 1 });
  doc.font("Helvetica-Bold").fontSize(5.8).text(v.declarationAccepted ? "Declaration accepted" : "Declaration not accepted", 387, row3Y + 58, { width: 183 });
  doc.font("Helvetica").fontSize(5.5).text(`Applicant Signature: ______________   Date: ${new Date(v.createdAt).toLocaleDateString("en-IN")}`, 387, row3Y + 76, { width: 183 });

  // ---- Office use ----
  const row4Y = row3Y + bh3 + 6, officeH = 63;
  section(x, row4Y, W, officeH, colors.brown, "FOR OFFICE USE ONLY");
  grid([
    ["Volunteer ID", v.code || v._id],
    ["Verification", v.verified ? "Verified" : "Pending"],
    ["Assigned Role", v.assignedRole],
    ["Assigned Area", v.assignedArea],
    ["Status", v.status],
    ["Approved By", v.approvedByName],
    ["Joining / Orientation Date", v.joiningDate ? new Date(v.joiningDate).toLocaleDateString("en-IN") : "—"],
  ], x, row4Y + 15, W, 5, 23);

  // ---- Footer ----
  const footerY = row4Y + officeH + 6, footerH = 38;
  doc.roundedRect(x, footerY, W, footerH, 5).fillColor("#6d0909").fill();
  doc.font("Helvetica-Bold").fontSize(10).fillColor("white").text("24x7 ASSISTANCE HELPLINE: 9654900525", x + 13, footerY + 13, { width: 260 });
  doc.fontSize(7).text("SEVA - SAMMAN - ANTIM GARIMA", x + 330, footerY + 14, { width: 210, align: "right" });

  doc.end();
  return done;
}

export async function updateVolunteerStatus(volunteerId: string, status: VolunteerStatus, actorUserId: string) {
  const volunteer = await Volunteer.findByIdAndUpdate(volunteerId, { status }, { new: true });
  if (!volunteer) throw ApiError.notFound("Volunteer not found");

  await writeAuditLog({
    userId: actorUserId,
    action: "volunteer.status_changed",
    entityType: "Volunteer",
    entityId: volunteer._id.toString(),
    after: { status },
  });

  return volunteer;
}

async function findMyVolunteerProfile(userId: string): Promise<IVolunteer> {
  const volunteer = await Volunteer.findOne({ userId });
  if (!volunteer) throw ApiError.notFound("Volunteer profile not found");
  return volunteer;
}
export async function getMyProfile(userId: string) {
  const volunteer = await findMyVolunteerProfile(userId);
  const user = await User.findById(userId).select("name phone email avatarUrl");
  const obj = volunteer.toObject();
  return {
    ...obj,
    address: obj.address ? decryptField(obj.address) : obj.address,
    name: user?.name,
    phone: user?.phone,
    email: user?.email,
    // Volunteer registration stores the uploaded profile photograph on the volunteer record.
    // Prefer a user-level avatar when one exists, otherwise expose that uploaded photograph to
    // the self-service dashboard under its stable `avatarUrl` contract.
    avatarUrl: user?.avatarUrl || obj.photographUrl,
  };
}

export async function updateMyAvailability(userId: string, availability: VolunteerAvailability) {
  const volunteer = await findMyVolunteerProfile(userId);
  const changed = volunteer.availability !== availability;
  volunteer.availability = availability;
  await volunteer.save();

  if (changed) {
    const user = await User.findById(userId).select("name");
    await notifyAdmins(
      "VOLUNTEER",
      `${user?.name ?? "A volunteer"} is now ${availability.charAt(0) + availability.slice(1).toLowerCase()}`,
      `${volunteer.city}`,
      "/volunteers"
    );
  }

  return volunteer;
}

interface UpdateMyVolunteerProfileInput {
  city?: string;
  skills?: string[];
  address?: string;
  state?: string;
  pincode?: string;
  schedulePreference?: VolunteerSchedulePreference;
  preferredRole?: VolunteerPreferredRole;
}
export async function updateMyVolunteerProfile(userId: string, input: UpdateMyVolunteerProfileInput) {
  const volunteer = await findMyVolunteerProfile(userId);
  const locationChanged =
    (input.city !== undefined && input.city !== volunteer.city) ||
    input.address !== undefined ||
    input.state !== undefined ||
    input.pincode !== undefined;

  if (input.city !== undefined) volunteer.city = input.city;
  if (input.skills !== undefined) volunteer.skills = input.skills;
  if (input.address !== undefined) volunteer.address = input.address;
  if (input.state !== undefined) volunteer.state = input.state;
  if (input.pincode !== undefined) volunteer.pincode = input.pincode;
  if (input.schedulePreference !== undefined) volunteer.schedulePreference = input.schedulePreference;
  if (input.preferredRole !== undefined) volunteer.preferredRole = input.preferredRole;
  await volunteer.save();
  if (locationChanged) {
    geocodeVolunteerAsync(volunteer._id.toString(), {
      address: volunteer.address ? decryptField(volunteer.address) : undefined,
      city: volunteer.city,
      state: volunteer.state,
      pincode: volunteer.pincode,
    });
  }

  const obj = volunteer.toObject();
  return { ...obj, address: obj.address ? decryptField(obj.address) : obj.address };
}
export async function listMyAssignments(userId: string) {
  const volunteer = await findMyVolunteerProfile(userId);
  const assignments = await VolunteerAssignment.find({ volunteerId: volunteer._id }).sort({ createdAt: -1 });

  const cases = await Case.find({ _id: { $in: assignments.map((a) => a.caseId) } }).select(
    "caseId status city priority scheduledAt"
  );
  const caseById = new Map(cases.map((c) => [c._id.toString(), c]));

  return assignments.map((a) => {
    const kase = caseById.get(a.caseId.toString());
    return {
      ...a.toObject(),
      case: kase
        ? { caseId: kase.caseId, status: kase.status, city: kase.city, priority: kase.priority, scheduledAt: kase.scheduledAt }
        : null,
    };
  });
}
export async function getMyAssignmentDetail(userId: string, assignmentId: string) {
  const volunteer = await findMyVolunteerProfile(userId);

  const assignment = await VolunteerAssignment.findOne({ _id: assignmentId, volunteerId: volunteer._id });
  if (!assignment) throw ApiError.notFound("Assignment not found");

  const kase = await Case.findById(assignment.caseId);
  if (!kase) throw ApiError.notFound("Case not found");

  const [request, timeline, caseManager] = await Promise.all([
    AssistanceRequest.findById(kase.requestId),
    CaseTimeline.find({ caseId: kase._id, visibility: "FAMILY" }).sort({ at: 1 }),
    kase.caseManagerId ? User.findById(kase.caseManagerId).select("name phone") : Promise.resolve(null),
  ]);

  return {
    assignment: assignment.toObject(),
    case: {
      caseId: kase.caseId,
      status: kase.status,
      priority: kase.priority,
      city: kase.city,
      scheduledAt: kase.scheduledAt,
    },
    pickup: request
      ? {
        address: decryptField(request.location.address),
        area: request.location.area,
        city: request.location.city,
        state: request.location.state,
        pincode: request.location.pincode,
      }
      : null,
    contact: request ? { name: request.requester.name, phone: request.requester.phone, altPhone: request.requester.altPhone } : null,
    caseManager: caseManager ? { name: caseManager.name, phone: caseManager.phone } : null,
    timeline: timeline.map((t) => ({ event: t.event, toStatus: t.toStatus, note: t.note, at: t.at })),
  };
}

/**
 * A volunteer uploading a document/photo (e.g. cremation proof) for one of their own assignments —
 * scoped exactly like getMyAssignmentDetail (ownership checked via the Volunteer→VolunteerAssignment
 * link, never trusted from the client). Otherwise identical to case.service.ts's addCaseDocument,
 * since a volunteer's upload is functionally the same operation an admin's is, just reached from a
 * different, ownership-scoped entry point.
 */
export async function uploadAssignmentDocument(
  userId: string,
  assignmentId: string,
  file: Express.Multer.File,
  docType: DocumentType,
  isProof: boolean
) {
  const volunteer = await findMyVolunteerProfile(userId);

  const assignment = await VolunteerAssignment.findOne({ _id: assignmentId, volunteerId: volunteer._id });
  if (!assignment) throw ApiError.notFound("Assignment not found");

  const kase = await Case.findById(assignment.caseId);
  if (!kase) throw ApiError.notFound("Case not found");

  const { url, publicId } = await uploadBuffer(file.buffer, `moksha-sewa/cases/${kase.caseId}`);

  const document = await CaseDocument.create({
    caseId: kase._id,
    docType,
    url,
    cloudinaryPublicId: publicId,
    fileName: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    isProof,
    uploadedBy: userId,
  });

  kase.documentCount += 1;
  await kase.save();

  await CaseTimeline.create({
    caseId: kase._id,
    event: "document.uploaded",
    note: docType,
    byUserId: userId,
    visibility: "INTERNAL",
  });

  return document;
}

/** A volunteer accepting/declining their own assignment — deliberately restricted to the
 * assignment's own volunteer (checked via the Volunteer profile owned by req.auth.userId, never
 * trusted from the client) and only while it's still in the ASSIGNED state. */
export async function respondToAssignment(userId: string, assignmentId: string, response: "ACCEPTED" | "DECLINED") {
  const volunteer = await findMyVolunteerProfile(userId);

  const assignment = await VolunteerAssignment.findOne({ _id: assignmentId, volunteerId: volunteer._id });
  if (!assignment) throw ApiError.notFound("Assignment not found");
  if (assignment.status !== "ASSIGNED") {
    throw ApiError.conflict("This assignment has already been responded to");
  }

  assignment.status = response;
  assignment.respondedAt = new Date();
  await assignment.save();

  if (response === "ACCEPTED") {
    volunteer.totalAssignments += 1;
    await volunteer.save();
  }

  return assignment;
}
