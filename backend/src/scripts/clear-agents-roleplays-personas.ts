/**
 * Removes all AGENT users, their sessions, all team roleplays, and all personas.
 * Companies, admins, managers, evaluation prompts, and usage logs are untouched.
 *
 * Usage:
 *   npx tsx src/scripts/clear-agents-roleplays-personas.ts           # live run
 *   npx tsx src/scripts/clear-agents-roleplays-personas.ts --dry-run  # preview only
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { config } from '../config';
import { User } from '../models/User';
import { Session } from '../models/Session';
import { TeamRoleplay } from '../models/TeamRoleplay';
import { Persona } from '../models/Persona';

const isDryRun = process.argv.includes('--dry-run');

async function main() {
  await mongoose.connect(config.mongoUri);
  console.log(`Connected to MongoDB: ${config.mongoUri}`);
  console.log(isDryRun ? '\n[DRY RUN — no data will be deleted]\n' : '\n[LIVE RUN — deleting data]\n');

  // ── Count what will be removed ────────────────────────────────────────────

  const agentIds = await User.find({ role: 'AGENT' }).distinct('_id');

  const [agentCount, sessionCount, roleplaysCount, personasCount] = await Promise.all([
    User.countDocuments({ role: 'AGENT' }),
    Session.countDocuments({ userId: { $in: agentIds } }),
    TeamRoleplay.countDocuments({}),
    Persona.countDocuments({}),
  ]);

  console.log('Items to be removed:');
  console.log(`  Agents (role=AGENT)  : ${agentCount}`);
  console.log(`  Sessions (agent-owned): ${sessionCount}`);
  console.log(`  Team Roleplays        : ${roleplaysCount}`);
  console.log(`  Personas              : ${personasCount}`);
  console.log('');

  if (isDryRun) {
    console.log('Dry run complete. Re-run without --dry-run to delete.');
    await mongoose.disconnect();
    return;
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  const [a, s, r, p] = await Promise.all([
    User.deleteMany({ role: 'AGENT' }),
    Session.deleteMany({ userId: { $in: agentIds } }),
    TeamRoleplay.deleteMany({}),
    Persona.deleteMany({}),
  ]);

  console.log('Deleted:');
  console.log(`  Agents         : ${a.deletedCount}`);
  console.log(`  Sessions       : ${s.deletedCount}`);
  console.log(`  Team Roleplays : ${r.deletedCount}`);
  console.log(`  Personas       : ${p.deletedCount}`);

  await mongoose.disconnect();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
