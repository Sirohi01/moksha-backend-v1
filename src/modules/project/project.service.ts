import { Project, IProject } from "../../models/project.model";
import { Organisation } from "../../models/organisation.model";
import { ApiError } from "../../utils/ApiError";
import { compactFilter } from "../../utils/compactFilter";
import { ProjectStatus } from "../../utils/constants";

interface ProjectInput {
  organisationId: string;
  programCode: string;
  code: string;
  name: string;
  editionLabel?: string;
  status?: ProjectStatus;
  description?: string;
  branding?: IProject["branding"];
  settings?: Record<string, unknown>;
  startDate?: Date;
  endDate?: Date;
}

export async function createProject(input: ProjectInput): Promise<IProject> {
  const organisation = await Organisation.findById(input.organisationId);
  if (!organisation) throw ApiError.badRequest("organisationId does not match an existing organisation");

  const existing = await Project.findOne({ code: input.code.toUpperCase() });
  if (existing) throw ApiError.conflict("A project with this code already exists");

  return Project.create(input);
}

export async function updateProject(
  id: string,
  updates: Partial<Omit<ProjectInput, "organisationId" | "programCode" | "code">>
): Promise<IProject> {
  const project = await Project.findById(id);
  if (!project) throw ApiError.notFound("Project not found");

  Object.assign(project, updates);
  await project.save();
  return project;
}

export async function listProjects(filter: {
  organisationId?: string;
  programCode?: string;
  status?: ProjectStatus;
}) {
  return Project.find(compactFilter(filter)).sort({ startDate: -1, name: 1 });
}

export async function getProjectById(id: string): Promise<IProject> {
  const project = await Project.findById(id);
  if (!project) throw ApiError.notFound("Project not found");
  return project;
}
export async function getProjectByCode(code: string): Promise<IProject | null> {
  return Project.findOne({ code: code.toUpperCase() });
}
