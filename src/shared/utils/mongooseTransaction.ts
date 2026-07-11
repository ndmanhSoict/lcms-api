import mongoose, { ClientSession } from 'mongoose';

function getTopologyType() {
  const client = mongoose.connection.getClient() as unknown as {
    topology?: { description?: { type?: string } };
  };
  return client.topology?.description?.type;
}

function isTransactionUnsupported(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('Transaction numbers are only allowed on a replica set member or mongos') ||
    message.includes('Transaction numbers are only allowed')
  );
}

export async function runOptionalTransaction<T>(
  work: (session?: ClientSession) => Promise<T>
): Promise<T> {
  const topologyType = getTopologyType();

  if (topologyType === 'Single') {
    return work(undefined);
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const result = await work(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    if (isTransactionUnsupported(error)) {
      return work(undefined);
    }
    throw error;
  } finally {
    session.endSession();
  }
}
