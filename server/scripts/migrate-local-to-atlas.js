import { MongoClient } from "mongodb";

const LOCAL_URI = "mongodb://127.0.0.1:27017";
const ATLAS_URI = process.env.MONGODB_URI;

const DB_NAME = "sales_operations";

if (!ATLAS_URI) {
  console.error("❌ MONGODB_URI was not found.");
  process.exit(1);
}

if (!ATLAS_URI.startsWith("mongodb+srv://")) {
  console.error("❌ MONGODB_URI does not appear to be an Atlas connection.");
  process.exit(1);
}

const localClient = new MongoClient(LOCAL_URI);
const atlasClient = new MongoClient(ATLAS_URI);

try {
  console.log("Connecting to LOCAL MongoDB...");
  await localClient.connect();
  console.log("✅ Local MongoDB connected");

  console.log("Connecting to MongoDB ATLAS...");
  await atlasClient.connect();
  console.log("✅ MongoDB Atlas connected");

  const localDb = localClient.db(DB_NAME);
  const atlasDb = atlasClient.db(DB_NAME);

  const collections = await localDb.listCollections().toArray();

  console.log(`\nFound ${collections.length} local collections.\n`);

  for (const collectionInfo of collections) {
    const name = collectionInfo.name;

    const localCollection = localDb.collection(name);
    const atlasCollection = atlasDb.collection(name);

    const documents = await localCollection.find({}).toArray();

    console.log(`📦 ${name}: ${documents.length} documents`);

    if (documents.length === 0) {
      console.log(`   ⏭ Nothing to copy`);
      continue;
    }

    // Upsert by _id so rerunning the migration does not
    // blindly create duplicate copies.
    const operations = documents.map((doc) => ({
      replaceOne: {
        filter: { _id: doc._id },
        replacement: doc,
        upsert: true,
      },
    }));

    const BATCH_SIZE = 500;

    for (let i = 0; i < operations.length; i += BATCH_SIZE) {
      const batch = operations.slice(i, i + BATCH_SIZE);

      await atlasCollection.bulkWrite(batch, {
        ordered: false,
      });
    }

    const atlasCount = await atlasCollection.countDocuments();

    console.log(
      `   ✅ Local: ${documents.length} | Atlas total: ${atlasCount}`
    );
  }

  console.log("\n=================================");
  console.log("✅ DATA MIGRATION COMPLETED");
  console.log("=================================");

  console.log("\nVerifying collection counts...\n");

  for (const collectionInfo of collections) {
    const name = collectionInfo.name;

    const localCount = await localDb
      .collection(name)
      .countDocuments();

    const atlasCount = await atlasDb
      .collection(name)
      .countDocuments();

    const status =
      localCount === atlasCount ? "✅" : "⚠️";

    console.log(
      `${status} ${name}: Local=${localCount} Atlas=${atlasCount}`
    );
  }
} catch (error) {
  console.error("\n❌ MIGRATION FAILED");
  console.error(error);
  process.exitCode = 1;
} finally {
  await localClient.close();
  await atlasClient.close();
}
