import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Job } from "../../../models/job.model";
import { createJob, getPublicJob, JobInput, listAdminJobs, listPublicJobs, updateJob } from "../job.service";

const input: JobInput = {
  title: "Programme Coordinator",
  slug: "programme-coordinator",
  location: "New Delhi",
  employmentType: "Full time",
  summary: "Coordinate Namo Gange programmes and partner activities.",
  description: "Own programme planning, reporting, partner coordination and delivery outcomes.",
  requirements: ["Three years of programme experience"],
  applicationEmail: "careers@namogange.org",
};

describe("scoped Namo Gange jobs", () => {
  let server: MongoMemoryServer;
  const namoId = new Types.ObjectId().toString();
  const otherId = new Types.ObjectId().toString();

  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    await mongoose.connect(server.getUri());
    await Job.syncIndexes();
  });

  afterEach(async () => Job.deleteMany({}));
  afterAll(async () => {
    await mongoose.disconnect();
    await server.stop();
  });

  it("isolates admin queries by server-resolved organisation id", async () => {
    await createJob(namoId, input);
    await createJob(otherId, { ...input, title: "Other tenant role" });

    expect(await listAdminJobs(namoId)).toHaveLength(1);
    expect((await listAdminJobs(namoId))[0].title).toBe(input.title);
  });

  it("only exposes published, non-expired jobs publicly", async () => {
    await createJob(namoId, { ...input, status: "DRAFT" });
    await createJob(namoId, {
      ...input,
      slug: "expired-role",
      status: "PUBLISHED",
      closesAt: new Date(Date.now() - 60_000),
    });
    await createJob(namoId, { ...input, slug: "open-role", status: "PUBLISHED" });

    const jobs = await listPublicJobs(namoId);
    expect(jobs.map((job) => job.slug)).toEqual(["open-role"]);
    await expect(getPublicJob(namoId, "expired-role")).rejects.toThrow("Job not found");
  });

  it("allows the same slug in different organisations", async () => {
    await createJob(namoId, input);
    await expect(createJob(otherId, input)).resolves.toBeDefined();
  });

  it("cannot update another organisation's record", async () => {
    const job = await createJob(namoId, input);
    await expect(updateJob(otherId, job._id.toString(), { title: "Cross-scope edit" }))
      .rejects.toThrow("Job not found");
  });
});
