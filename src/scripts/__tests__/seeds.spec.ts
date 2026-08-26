import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { seedOrganisations } from '../seedOrganisations';
import { seedProjects } from '../seedProjects';
import { seedAccessGrants } from '../seedAccessGrants';
import { Organisation } from '../../models/organisation.model';
import { Project } from '../../models/project.model';
import { AccessGrant } from '../../models/accessGrant.model';
import { Role } from '../../models/role.model';
import { User } from '../../models/user.model';

describe('Seed Scripts', () => {
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
    await Project.deleteMany({});
    await AccessGrant.deleteMany({});
    await Role.deleteMany({});
    await User.deleteMany({});
  });

  describe('seedOrganisations', () => {
    it('running it twice doesn\'t create duplicates (idempotent), creates exactly the 3 expected codes (MOKSHA, NAMOGANGE, AROGYA)', async () => {
      await seedOrganisations();
      
      const count1 = await Organisation.countDocuments();
      expect(count1).toBe(3);
      
      const orgs = await Organisation.find({}, 'code');
      const codes = orgs.map(o => o.code).sort();
      expect(codes).toEqual(['AROGYA', 'MOKSHA', 'NAMOGANGE']);

      // Run again
      await seedOrganisations();
      const count2 = await Organisation.countDocuments();
      expect(count2).toBe(3); // Idempotent check
    });
  });

  describe('seedProjects', () => {
    it('fails gracefully (doesn\'t throw, logs and skips) if the referenced organisation doesn\'t exist yet', async () => {
      // Do NOT run seedOrganisations() before this
      await expect(seedProjects()).resolves.not.toThrow();
      
      const projectsCount = await Project.countDocuments();
      expect(projectsCount).toBe(0); // None should be created since orgs are missing

      // Now seed orgs and then projects
      await seedOrganisations();
      const namoGange = await Organisation.findOne({ code: 'NAMOGANGE' }).orFail();
      await Project.create([
        {
          organisationId: namoGange._id,
          programCode: 'AGS',
          code: 'AGS-2026',
          name: 'Legacy AGS seed',
          status: 'ACTIVE',
        },
        {
          organisationId: namoGange._id,
          programCode: 'TGYM',
          code: 'TGYM-2026',
          name: 'Legacy TGYM seed',
          status: 'ACTIVE',
        },
      ]);
      await seedProjects();
      
      const projectsCountAfter = await Project.countDocuments();
      expect(projectsCountAfter).toBe(3); // Historical rows are retained but no longer selectable.
      const projects = await Project.find({ status: 'ACTIVE' }).populate('organisationId', 'code').lean();
      expect(projects).toHaveLength(1);
      expect((projects[0].organisationId as unknown as { code: string }).code).toBe('AROGYA');
      expect(projects[0].programCode).toBe('AROGYA-SANGOSHTI');
      expect(await Project.countDocuments({
        organisationId: namoGange._id,
        programCode: { $in: ['AGS', 'TGYM'] },
        status: 'ACTIVE',
      })).toBe(0);
      
      // Idempotent check
      await seedProjects();
      const projectsCountFinal = await Project.countDocuments();
      expect(projectsCountFinal).toBe(3);
    });
  });

  describe('seedAccessGrants', () => {
    it('only grants access to users whose roleId matches the super_admin role', async () => {
      const superAdminRole = await Role.create({
        name: 'Super Admin',
        slug: 'super_admin'
      });
      
      const normalRole = await Role.create({
        name: 'Normal User',
        slug: 'normal_user'
      });

      const superAdmin = await User.create({
        name: 'Super Admin User',
        email: 'super@test.com',
        phone: '1111111111',
        roleId: superAdminRole._id,
        status: 'ACTIVE'
      });

      const normalUser = await User.create({
        name: 'Normal User',
        email: 'normal@test.com',
        phone: '2222222222',
        roleId: normalRole._id,
        status: 'ACTIVE'
      });

      await seedAccessGrants();

      const grants = await AccessGrant.find({});
      expect(grants.length).toBe(1);
      
      const grant = grants[0];
      expect(grant.userId.toString()).toBe(superAdmin._id.toString());
      expect(grant.userId.toString()).not.toBe(normalUser._id.toString());
      expect(grant.organisationId).toBeNull();
      
      // Idempotent check
      await seedAccessGrants();
      const grantsAfter = await AccessGrant.find({});
      expect(grantsAfter.length).toBe(1);
    });
  });
});
