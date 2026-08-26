import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";
import * as projectService from "./project.service";
import { ProjectStatus } from "../../utils/constants";

export const listProjects = asyncHandler(async (req: Request, res: Response) => {
  const { organisationId, programCode, status } = req.query as {
    organisationId?: string;
    programCode?: string;
    status?: ProjectStatus;
  };
  const projects = await projectService.listProjects({ organisationId, programCode, status });
  sendSuccess(res, 200, "Projects fetched", projects);
});

export const getProject = asyncHandler(async (req: Request, res: Response) => {
  const project = await projectService.getProjectById(req.params.id);
  sendSuccess(res, 200, "Project fetched", project);
});

export const createProject = asyncHandler(async (req: Request, res: Response) => {
  const project = await projectService.createProject(req.body);
  sendSuccess(res, 201, "Project created", project);
});

export const updateProject = asyncHandler(async (req: Request, res: Response) => {
  const project = await projectService.updateProject(req.params.id, req.body);
  sendSuccess(res, 200, "Project updated", project);
});
