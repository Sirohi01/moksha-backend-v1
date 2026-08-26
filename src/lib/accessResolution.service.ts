import { AccessGrant } from "../models/accessGrant.model";
import { Organisation } from "../models/organisation.model";
import { Project, IProject } from "../models/project.model";

export interface MyAccessProject {
  _id: string;
  code: string;
  name: string;
  programCode: string;
}

export interface MyAccessOrganisation {
  code: string;
  name: string;
  allProjects: boolean;
  projects: MyAccessProject[];
}

export interface MyAccess {
  isSuperAdmin: boolean;
  organisations: MyAccessOrganisation[];
}

function toProjectSummary(project: IProject): MyAccessProject {
  return {
    _id: project._id.toString(),
    code: project.code,
    name: project.name,
    programCode: project.programCode,
  };
}
export async function resolveMyAccess(userId: string): Promise<MyAccess> {
  const now = new Date();
  const grants = await AccessGrant.find({
    userId,
    status: "ACTIVE",
    $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }],
  });

  const isSuperAdmin = grants.some((grant) => grant.organisationId === null);

  if (isSuperAdmin) {
    const allOrganisations = await Organisation.find({ status: "ACTIVE" }).sort({ name: 1 });
    const organisations = await Promise.all(
      allOrganisations.map(async (org) => {
        const projects = await Project.find({ organisationId: org._id, status: "ACTIVE" });
        return {
          code: org.code,
          name: org.name,
          allProjects: true,
          projects: projects.map(toProjectSummary),
        };
      })
    );
    return { isSuperAdmin: true, organisations };
  }

  const grantsByOrgId = new Map<string, { allProjects: boolean; programCodes: Set<string> }>();
  for (const grant of grants) {
    if (!grant.organisationId) continue; // guarded above by isSuperAdmin; defensive only
    const key = grant.organisationId.toString();
    const entry = grantsByOrgId.get(key) ?? { allProjects: false, programCodes: new Set<string>() };
    if (grant.programCode === null) entry.allProjects = true;
    else entry.programCodes.add(grant.programCode);
    grantsByOrgId.set(key, entry);
  }

  const organisations: MyAccessOrganisation[] = [];
  for (const [orgId, entry] of grantsByOrgId) {
    const org = await Organisation.findOne({ _id: orgId, status: "ACTIVE" });
    if (!org) continue; // grant references an inactive/deleted organisation — skip, don't error

    const projectQuery: Record<string, unknown> = { organisationId: org._id, status: "ACTIVE" };
    if (!entry.allProjects) {
      projectQuery.programCode = { $in: Array.from(entry.programCodes) };
    }
    const projects = await Project.find(projectQuery);

    organisations.push({
      code: org.code,
      name: org.name,
      allProjects: entry.allProjects,
      projects: projects.map(toProjectSummary),
    });
  }

  return { isSuperAdmin: false, organisations };
}
