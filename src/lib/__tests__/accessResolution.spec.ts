import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { resolveMyAccess } from '../accessResolution.service';
import { AccessGrant } from '../../models/accessGrant.model';
import { Organisation } from '../../models/organisation.model';
import { Project } from '../../models/project.model';

describe('accessResolution.service.ts', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await AccessGrant.deleteMany({});
    await Organisation.deleteMany({});
    await Project.deleteMany({});
  });

  const createFixtures = async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const roleId = new mongoose.Types.ObjectId();
    const grantedBy = new mongoose.Types.ObjectId();

    const org1 = await Organisation.create({
      code: 'ORG1',
      name: 'Organisation 1',
      slug: 'org-1',
      status: 'ACTIVE',
    });

    const org2 = await Organisation.create({
      code: 'ORG2',
      name: 'Organisation 2',
      slug: 'org-2',
      status: 'ACTIVE',
    });

    const inactiveOrg = await Organisation.create({
      code: 'INACTIVE_ORG',
      name: 'Inactive Organisation',
      slug: 'inactive-org',
      status: 'INACTIVE',
    });

    const proj1 = await Project.create({
      code: 'PROJ1',
      name: 'Project 1',
      slug: 'proj-1',
      programCode: 'CODE1',
      organisationId: org1._id,
      status: 'ACTIVE',
    });

    const proj2 = await Project.create({
      code: 'PROJ2',
      name: 'Project 2',
      slug: 'proj-2',
      programCode: 'CODE2',
      organisationId: org1._id,
      status: 'ACTIVE',
    });

    const inactiveProj = await Project.create({
      code: 'PROJ3',
      name: 'Project 3',
      slug: 'proj-3',
      programCode: 'CODE1',
      organisationId: org1._id,
      status: 'INACTIVE',
    });

    return { userId, roleId, grantedBy, org1, org2, inactiveOrg, proj1, proj2, inactiveProj };
  };

  it('1. User with an organisationId: null grant -> isSuperAdmin: true, organisations includes every ACTIVE Organisation with allProjects: true', async () => {
    const { userId, roleId, grantedBy, org1, org2 } = await createFixtures();
    await AccessGrant.create({
      userId,
      organisationId: null,
      programCode: null,
      roleId,
      status: 'ACTIVE',
      grantedBy,
    });

    const result = await resolveMyAccess(userId);
    
    expect(result.isSuperAdmin).toBe(true);
    expect(result.organisations.length).toBe(2); // Only ACTIVE ones
    const codes = result.organisations.map(o => o.code).sort();
    expect(codes).toEqual([org1.code, org2.code].sort());
    
    for (const org of result.organisations) {
      expect(org.allProjects).toBe(true);
      if (org.code === org1.code) {
        expect(org.projects.length).toBe(2); // proj1, proj2 (excludes inactiveProj)
      } else {
        expect(org.projects.length).toBe(0);
      }
    }
  });

  it('2. User with a grant scoped to one organisation, programCode: null -> that organisation appears with allProjects: true', async () => {
    const { userId, roleId, grantedBy, org1 } = await createFixtures();
    await AccessGrant.create({
      userId,
      organisationId: org1._id,
      programCode: null,
      roleId,
      status: 'ACTIVE',
      grantedBy,
    });

    const result = await resolveMyAccess(userId);
    
    expect(result.isSuperAdmin).toBe(false);
    expect(result.organisations.length).toBe(1);
    expect(result.organisations[0].code).toBe(org1.code);
    expect(result.organisations[0].allProjects).toBe(true);
    expect(result.organisations[0].projects.length).toBe(2); // both active projects
  });

  it('3. User with a grant scoped to one organisation + a specific programCode -> allProjects: false and projects containing only ACTIVE matching that code', async () => {
    const { userId, roleId, grantedBy, org1, proj1 } = await createFixtures();
    await AccessGrant.create({
      userId,
      organisationId: org1._id,
      programCode: 'CODE1',
      roleId,
      status: 'ACTIVE',
      grantedBy,
    });

    const result = await resolveMyAccess(userId);
    
    expect(result.isSuperAdmin).toBe(false);
    expect(result.organisations.length).toBe(1);
    expect(result.organisations[0].code).toBe(org1.code);
    expect(result.organisations[0].allProjects).toBe(false);
    expect(result.organisations[0].projects.length).toBe(1);
    expect(result.organisations[0].projects[0].programCode).toBe(proj1.programCode);
    expect(result.organisations[0].projects[0].code).toBe(proj1.code);
  });

  it('4. User with an expired grant (expiresAt in the past) -> that organisation does not appear at all', async () => {
    const { userId, roleId, grantedBy, org1 } = await createFixtures();
    await AccessGrant.create({
      userId,
      organisationId: org1._id,
      programCode: null,
      roleId,
      status: 'ACTIVE',
      grantedBy,
      expiresAt: new Date(Date.now() - 10000), // expired
    });

    const result = await resolveMyAccess(userId);
    
    expect(result.isSuperAdmin).toBe(false);
    expect(result.organisations.length).toBe(0);
  });

  it('5. User with a grant referencing an organisation that has gone INACTIVE -> organisation does not appear', async () => {
    const { userId, roleId, grantedBy, inactiveOrg } = await createFixtures();
    await AccessGrant.create({
      userId,
      organisationId: inactiveOrg._id,
      programCode: null,
      roleId,
      status: 'ACTIVE',
      grantedBy,
    });

    const result = await resolveMyAccess(userId);
    
    expect(result.isSuperAdmin).toBe(false);
    expect(result.organisations.length).toBe(0);
  });

  it('6. User with zero grants -> { isSuperAdmin: false, organisations: [] }', async () => {
    const { userId } = await createFixtures();
    
    const result = await resolveMyAccess(userId);
    
    expect(result.isSuperAdmin).toBe(false);
    expect(result.organisations).toEqual([]);
  });
});
