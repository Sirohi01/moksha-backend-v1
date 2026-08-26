import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { authorizeScoped } from '../access.middleware';
import { Organisation } from '../../models/organisation.model';
import { AccessGrant } from '../../models/accessGrant.model';
import { Role } from '../../models/role.model';
import { Permission } from '../../models/permission.model';
import { ApiError } from '../../utils/ApiError';

describe('authorizeScoped Middleware', () => {
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
    await Organisation.deleteMany({});
    await AccessGrant.deleteMany({});
    await Role.deleteMany({});
    await Permission.deleteMany({});
  });

  const runMiddleware = async (options: any, req: any) => {
    const next = jest.fn();
    const middleware = authorizeScoped(options);
    await new Promise<void>((resolve) => {
      const mockNext = (...args: any[]) => {
        next(...args);
        resolve();
      };
      middleware(req, {} as any, mockNext as any);
    });
    return { req, next };
  };

  const setupFixtures = async (hasPermission: boolean = true) => {
    const userId = new mongoose.Types.ObjectId();
    const superAdminUserId = new mongoose.Types.ObjectId();

    const org = await Organisation.create({
      code: 'NAMOGANGE',
      name: 'Namo Gange',
      slug: 'namo-gange',
      status: 'ACTIVE',
    });

    const perm = await Permission.create({
      module: 'events',
      action: 'read',
      key: 'events.read',
      label: 'Read Events',
    });

    const role = await Role.create({
      name: 'Event Manager',
      slug: 'event-manager',
      permissionIds: hasPermission ? [perm._id] : [],
    });

    return { userId, superAdminUserId, org, perm, role };
  };

  it('1. No AccessGrant for the user -> denied', async () => {
    const { userId, org } = await setupFixtures();
    const { next } = await runMiddleware(
      { permission: 'events.read', organisation: org.code },
      { auth: { userId, twoFactorPending: false } } as any
    );
    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
  });

  it('2. AccessGrant with organisationId: null + a role carrying the permission -> allowed', async () => {
    const { userId, superAdminUserId, org, role } = await setupFixtures();
    await AccessGrant.create({
      userId,
      organisationId: null,
      programCode: null,
      roleId: role._id,
      grantedBy: superAdminUserId,
    });

    const { req, next } = await runMiddleware(
      { permission: 'events.read', organisation: org.code },
      { auth: { userId, twoFactorPending: false } } as any
    );
    
    expect(next).toHaveBeenCalledWith(); // no argument -> allowed
    expect(req.scope).toBeDefined();
    expect(req.scope?.organisationId).toBe(org._id.toString());
    expect(req.scope?.organisationCode).toBe(org.code);
  });

  it('3. AccessGrant scoped to exact org, programCode: null, route requires a project -> allowed', async () => {
    const { userId, superAdminUserId, org, role } = await setupFixtures();
    await AccessGrant.create({
      userId,
      organisationId: org._id,
      programCode: null,
      roleId: role._id,
      grantedBy: superAdminUserId,
    });

    const { req, next } = await runMiddleware(
      { permission: 'events.read', organisation: org.code, project: 'AGS' },
      { auth: { userId, twoFactorPending: false } } as any
    );

    expect(next).toHaveBeenCalledWith();
    expect(req.scope?.programCode).toBe('AGS');
  });

  it('4. AccessGrant scoped to org + programCode "AGS", route requires project "TGYM" -> denied', async () => {
    const { userId, superAdminUserId, org, role } = await setupFixtures();
    await AccessGrant.create({
      userId,
      organisationId: org._id,
      programCode: 'AGS',
      roleId: role._id,
      grantedBy: superAdminUserId,
    });

    const { next } = await runMiddleware(
      { permission: 'events.read', organisation: org.code, project: 'TGYM' },
      { auth: { userId, twoFactorPending: false } } as any
    );

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
  });

  it('5. AccessGrant with expiresAt in the past -> denied even though org/project match', async () => {
    const { userId, superAdminUserId, org, role } = await setupFixtures();
    await AccessGrant.create({
      userId,
      organisationId: org._id,
      programCode: 'AGS',
      roleId: role._id,
      grantedBy: superAdminUserId,
      expiresAt: new Date(Date.now() - 10000), // past
    });

    const { next } = await runMiddleware(
      { permission: 'events.read', organisation: org.code, project: 'AGS' },
      { auth: { userId, twoFactorPending: false } } as any
    );

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
  });

  it('6. AccessGrant matches org/project but role lacks permission -> denied', async () => {
    const { userId, superAdminUserId, org, role } = await setupFixtures(false); // role without permission
    await AccessGrant.create({
      userId,
      organisationId: org._id,
      programCode: 'AGS',
      roleId: role._id,
      grantedBy: superAdminUserId,
    });

    const { next } = await runMiddleware(
      { permission: 'events.read', organisation: org.code, project: 'AGS' },
      { auth: { userId, twoFactorPending: false } } as any
    );

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
  });
});
