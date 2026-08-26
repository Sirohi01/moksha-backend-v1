import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import {
  createAccessGrant,
  revokeAccessGrant,
  updateAccessGrantExpiry,
  listAccessGrants
} from '../accessGrant.service';
import { AccessGrant } from '../../../models/accessGrant.model';
import { Organisation } from '../../../models/organisation.model';
import { Role } from '../../../models/role.model';
import { User } from '../../../models/user.model';
import { ApiError } from '../../../utils/ApiError';

describe('accessGrant.service.ts', () => {
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
    await Role.deleteMany({});
    await User.deleteMany({});
  });

  const setupFixtures = async () => {
    const user = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      phone: '9999999999',
      status: 'ACTIVE'
    });
    const grantedBy = new mongoose.Types.ObjectId().toString();

    const org = await Organisation.create({
      code: 'ORG1',
      name: 'Organisation 1',
      slug: 'org-1',
      status: 'ACTIVE',
    });

    const role = await Role.create({
      name: 'Test Role',
      slug: 'test-role',
    });

    return { user, org, role, grantedBy };
  };

  it('1. createAccessGrant rejects an unknown userId/roleId/organisationId with ApiError', async () => {
    const { user, org, role, grantedBy } = await setupFixtures();
    const fakeId = new mongoose.Types.ObjectId().toString();

    // Unknown user
    await expect(createAccessGrant({
      userId: fakeId,
      roleId: role._id.toString(),
      organisationId: org._id.toString(),
    }, grantedBy)).rejects.toThrow(ApiError);
    
    // Unknown role
    await expect(createAccessGrant({
      userId: user._id.toString(),
      roleId: fakeId,
      organisationId: org._id.toString(),
    }, grantedBy)).rejects.toThrow(ApiError);

    // Unknown org
    await expect(createAccessGrant({
      userId: user._id.toString(),
      roleId: role._id.toString(),
      organisationId: fakeId,
    }, grantedBy)).rejects.toThrow(ApiError);
  });

  it('2. createAccessGrant with organisationId omitted/null succeeds (the all-organisations case)', async () => {
    const { user, role, grantedBy } = await setupFixtures();
    
    const grant = await createAccessGrant({
      userId: user._id.toString(),
      roleId: role._id.toString(),
      organisationId: null, // explicit null
    }, grantedBy);

    expect(grant).toBeDefined();
    expect(grant.organisationId).toBeNull();
    expect(grant.status).toBe('ACTIVE');

    const grant2 = await createAccessGrant({
      userId: user._id.toString(),
      roleId: role._id.toString(),
      // omitted
    }, grantedBy);

    expect(grant2).toBeDefined();
    expect(grant2.organisationId).toBeNull();
  });

  it('3. revokeAccessGrant sets status to REVOKED and is idempotent', async () => {
    const { user, org, role, grantedBy } = await setupFixtures();
    
    const grant = await createAccessGrant({
      userId: user._id.toString(),
      roleId: role._id.toString(),
      organisationId: org._id.toString(),
    }, grantedBy);

    // First revocation
    const revoked1 = await revokeAccessGrant(grant._id.toString());
    expect(revoked1.status).toBe('REVOKED');

    // Second revocation (idempotent)
    const revoked2 = await revokeAccessGrant(grant._id.toString());
    expect(revoked2.status).toBe('REVOKED'); // Should not throw
  });

  it('4. updateAccessGrantExpiry rejects changing expiry on an already-REVOKED grant', async () => {
    const { user, org, role, grantedBy } = await setupFixtures();
    
    const grant = await createAccessGrant({
      userId: user._id.toString(),
      roleId: role._id.toString(),
      organisationId: org._id.toString(),
    }, grantedBy);

    await revokeAccessGrant(grant._id.toString());

    const newExpiry = new Date(Date.now() + 10000);
    try {
      await updateAccessGrantExpiry(grant._id.toString(), newExpiry);
      fail('Should have thrown ApiError');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe("Only an active grant's expiry can be changed");
    }
  });

  it('5. listAccessGrants filters correctly by userId, organisationId, and status', async () => {
    const { user, org, role, grantedBy } = await setupFixtures();
    
    const user2 = await User.create({
      name: 'User 2',
      email: 'user2@example.com',
      phone: '8888888888',
      status: 'ACTIVE'
    });
    
    const org2 = await Organisation.create({
      code: 'ORG2',
      name: 'Organisation 2',
      slug: 'org-2',
      status: 'ACTIVE',
    });

    await createAccessGrant({
      userId: user._id.toString(),
      roleId: role._id.toString(),
      organisationId: org._id.toString(),
    }, grantedBy);

    await createAccessGrant({
      userId: user._id.toString(),
      roleId: role._id.toString(),
      organisationId: org2._id.toString(),
    }, grantedBy);

    const grant3 = await createAccessGrant({
      userId: user2._id.toString(),
      roleId: role._id.toString(),
      organisationId: org._id.toString(),
    }, grantedBy);
    
    await revokeAccessGrant(grant3._id.toString());

    // By userId
    const listByUser = await listAccessGrants({ userId: user._id.toString() });
    expect(listByUser.length).toBe(2);

    // By organisationId
    const listByOrg = await listAccessGrants({ organisationId: org._id.toString() });
    expect(listByOrg.length).toBe(2);

    // By status
    const listRevoked = await listAccessGrants({ status: 'REVOKED' });
    expect(listRevoked.length).toBe(1);
    expect(listRevoked[0]._id.toString()).toBe(grant3._id.toString());
  });
});
