import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import {
  createProject,
  updateProject,
  listProjects,
  getProjectById,
  getProjectByCode,
} from '../project.service';
import { createOrganisation } from '../../organisation/organisation.service';
import { Project } from '../../../models/project.model';
import { Organisation } from '../../../models/organisation.model';
import { ApiError } from '../../../utils/ApiError';

describe('Project Service', () => {
  let mongoServer: MongoMemoryServer;
  let defaultOrgId: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    const org = await createOrganisation({
      code: 'ORG1',
      name: 'Org 1',
      slug: 'org-1',
    });
    defaultOrgId = org._id.toString();
  });

  afterEach(async () => {
    await Project.deleteMany({});
    await Organisation.deleteMany({});
  });

  it('should create a project', async () => {
    const project = await createProject({
      organisationId: defaultOrgId,
      programCode: 'PROG1',
      code: 'P-001',
      name: 'Project 1',
    });
    expect(project.code).toBe('P-001');
    expect(project.programCode).toBe('PROG1');
  });

  it('should throw badRequest when creating project with non-existent organisationId', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    await expect(
      createProject({
        organisationId: fakeId,
        programCode: 'PROG2',
        code: 'P-002',
        name: 'Project 2',
      })
    ).rejects.toThrowError(ApiError);
  });

  it('should list projects and filter correctly', async () => {
    await createProject({
      organisationId: defaultOrgId,
      programCode: 'PROG-FILTER',
      code: 'P-F1',
      name: 'Filter 1',
      status: 'ACTIVE',
    });
    await createProject({
      organisationId: defaultOrgId,
      programCode: 'PROG-OTHER',
      code: 'P-F2',
      name: 'Filter 2',
      status: 'ARCHIVED',
    });

    const all = await listProjects({});
    expect(all.length).toBe(2);

    const byProg = await listProjects({ programCode: 'PROG-FILTER' });
    expect(byProg.length).toBe(1);
    expect(byProg[0].code).toBe('P-F1');

    const byStatus = await listProjects({ status: 'ARCHIVED' });
    expect(byStatus.length).toBe(1);
    expect(byStatus[0].code).toBe('P-F2');
    
    const byOrg = await listProjects({ organisationId: defaultOrgId });
    expect(byOrg.length).toBe(2);
  });

  it('should fetch project by id', async () => {
    const p = await createProject({
      organisationId: defaultOrgId,
      programCode: 'ID',
      code: 'P-ID',
      name: 'P ID',
    });
    const fetched = await getProjectById(p._id.toString());
    expect(fetched.code).toBe('P-ID');
  });

  it('should fetch project by code', async () => {
    await createProject({
      organisationId: defaultOrgId,
      programCode: 'CODE',
      code: 'P-CODE',
      name: 'P CODE',
    });
    const fetched = await getProjectByCode('P-CODE');
    expect(fetched?.code).toBe('P-CODE');
  });

  it('should update project', async () => {
    const p = await createProject({
      organisationId: defaultOrgId,
      programCode: 'UPD',
      code: 'P-UPD',
      name: 'P UPD',
    });

    const updated = await updateProject(p._id.toString(), { name: 'P UPDATED' });
    expect(updated.name).toBe('P UPDATED');
    expect(updated._id.toString()).toBe(p._id.toString());
  });
});
