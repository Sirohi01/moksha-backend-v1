import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { NamoAgsDelegate } from "../../../models/namoAgsDelegate.model";
import { createDelegate, getDelegate, listDelegates, updateDelegate } from "../namoAgsDelegate.service";

const input = {
  firstName: "Ramesh",
  lastName: "Kumar",
  mobile: "9876543210",
  email: "ramesh@example.com",
  coordinator: "Priya",
};

describe("scoped Namo Gange AGS delegates", () => {
  let server: MongoMemoryServer;
  const namoId = new Types.ObjectId().toString();
  const otherId = new Types.ObjectId().toString();
  const userId = new Types.ObjectId().toString();

  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    await mongoose.connect(server.getUri());
    await NamoAgsDelegate.syncIndexes();
  });

  afterEach(async () => NamoAgsDelegate.deleteMany({}));
  afterAll(async () => {
    await mongoose.disconnect();
    await server.stop();
  });

  it("isolates queries by server-resolved organisation id", async () => {
    await createDelegate(namoId, input, userId);
    await createDelegate(otherId, { ...input, firstName: "Other tenant" }, userId);

    const delegates = await listDelegates(namoId, {});
    expect(delegates).toHaveLength(1);
    expect(delegates[0].firstName).toBe("Ramesh");
  });

  it("defaults clientStatus to NEW and status to ACTIVE", async () => {
    const delegate = await createDelegate(namoId, input, userId);
    expect(delegate.clientStatus).toBe("NEW");
    expect(delegate.status).toBe("ACTIVE");
  });

  it("does NOT enforce dedup on mobile/email — a repeat enquiry is a valid signal, not an error", async () => {
    await createDelegate(namoId, input, userId);
    await expect(createDelegate(namoId, input, userId)).resolves.toBeDefined();
    expect(await listDelegates(namoId, {})).toHaveLength(2);
  });

  it("allows moving between any two clientStatus values — no transition table was ever confirmed to exist", async () => {
    const created = await createDelegate(namoId, input, userId);
    const toHot = await updateDelegate(namoId, created._id as unknown as string, { clientStatus: "HOT" }, userId);
    expect(toHot.clientStatus).toBe("HOT");
    const backToNew = await updateDelegate(namoId, created._id as unknown as string, { clientStatus: "NEW" }, userId);
    expect(backToNew.clientStatus).toBe("NEW");
  });

  it("cannot read or update another organisation's record", async () => {
    const delegate = await createDelegate(namoId, input, userId);
    await expect(getDelegate(otherId, delegate._id as unknown as string)).rejects.toThrow("Delegate not found");
    await expect(updateDelegate(otherId, delegate._id as unknown as string, { remark: "x" }, userId))
      .rejects.toThrow("Delegate not found");
  });

  it("round-trips encrypted contact fields back to plaintext on read", async () => {
    const created = await createDelegate(namoId, input, userId);
    const fetched = await getDelegate(namoId, created._id as unknown as string);
    expect(fetched.mobile).toBe(input.mobile);
    expect(fetched.email).toBe(input.email);
  });
});
