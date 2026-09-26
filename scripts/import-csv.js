import fs from 'node:fs';
import path from 'node:path';
import { Database } from 'bun:sqlite';

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '_');
}

function parseCSVLine(line) {
  const parts = [];
  let inQuotes = false;
  let cur = '';
  for (let c of line) {
    if (c === '"') inQuotes = !inQuotes;
    else if (c === ',' && !inQuotes) { parts.push(cur.trim()); cur = ''; }
    else cur += c;
  }
  parts.push(cur.trim());
  return parts;
}

function parseDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.trim().split('/');
  if (parts.length === 3) {
    let m = parts[0].padStart(2, '0');
    let d = parts[1].padStart(2, '0');
    let y = parts[2];
    if (y.length === 2) {
      const num = parseInt(y, 10);
      y = num >= 70 ? '19' + y : '20' + y;
    }
    return `${y}-${m}-${d}`;
  }
  return dateStr;
}

function parseCourseInfo(courseField) {
  const match = courseField.match(/^(.*?)(?:\s*\(([\d.]+)\s*,\s*([\d.]+)\))?$/);
  const fullText = match ? match[1].trim() : courseField.trim();
  const rating = match && match[2] ? parseFloat(match[2]) : 72.0;
  const slope = match && match[3] ? parseFloat(match[3]) : 113;

  let courseName = fullText;
  let teeName = 'Standard';

  const teePattern = /\s+(White|Gold|Blue|Black|Red|Combo|Silver|Jade|Green|Bear|Cub|Red-Purple|Grey|Middle|Jade|Pine|1\*|2\*|Yellow|Orange|Copper|Emerald|Burgundy|Ruby|Plum|Champagne|Sage|Bronze|Pecan|Mesquite|Cholla|Ocotillo|Desert|Mountain|Ironwood|Lakes|Pines|River|Oaks|Valley|Canyon|Arbor|Links|Woodland)$/i;
  
  if (courseName.includes(' - ')) {
    const parts = courseName.split(' - ');
    courseName = parts[0].trim();
    teeName = parts.slice(1).join(' - ').trim();
  } else {
    const m = courseName.match(teePattern);
    if (m) {
      teeName = m[1];
      courseName = courseName.slice(0, m.index).trim();
    }
  }

  return { 
    courseName: courseName.replace(/\s+/g, ' '), 
    teeName, 
    rating, 
    slope 
  };
}

export function importCsvToDatabase(csvPath = '2026-09-10-rounds.csv', dbPath = 'local-dev.db') {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }

  const text = fs.readFileSync(csvPath, 'utf8');
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  console.log(`📂 Reading ${lines.length - 1} rows from ${csvPath}...`);

  const coursesMap = new Map();
  const parsedRounds = [];

  // Parse CSV (rows are ordered newest to oldest)
  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    const courseRaw = row[0];
    if (!courseRaw) continue;

    const info = parseCourseInfo(courseRaw);
    const date = parseDate(row[3]);
    const player = row[4] || 'Tim';
    const score = parseInt(row[5], 10) || 72;
    const diff = row[7] ? parseFloat(row[7]) : Math.round(((113 / info.slope) * (score - info.rating)) * 10) / 10;
    const recordedIndex = row[8] ? parseFloat(row[8]) : null;
    const rank = row[10] ? parseInt(row[10], 10) : null;

    const courseSlug = 'crs_' + slugify(info.courseName);

    // Track course and tee definitions (newest first = latest rating/slope kept)
    if (!coursesMap.has(courseSlug)) {
      coursesMap.set(courseSlug, {
        id: courseSlug,
        name: info.courseName,
        city: '',
        state: '',
        tees: new Map()
      });
    }

    const courseObj = coursesMap.get(courseSlug);
    const teeKey = `${info.teeName}_${player}`;
    if (!courseObj.tees.has(teeKey)) {
      courseObj.tees.set(teeKey, {
        name: info.teeName,
        rating: info.rating,
        slope: info.slope,
        par: 72,
        player: player
      });
    }

    const roundId = `rnd_${date.replace(/-/g, '')}_${i}_${slugify(player)}`;

    const now = new Date().toISOString();
    parsedRounds.push({
      id: roundId,
      date,
      player,
      course_id: courseSlug,
      course_name: info.courseName,
      tee_name: info.teeName,
      course_rating: info.rating,
      slope_rating: info.slope,
      par: 72,
      holes_played: 18,
      score,
      differential: diff,
      stats: {
        player,
        recorded_index: recordedIndex,
        rank
      },
      notes: '',
      created_at: `${date}T12:00:00.000Z`,
      updated_at: now
    });
  }

  // Format courses catalog
  const finalCourses = Array.from(coursesMap.values()).map(c => ({
    id: c.id,
    name: c.name,
    city: c.city,
    state: c.state,
    tees: Array.from(c.tees.values()),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));

  console.log(`⛳ Consolidated ${finalCourses.length} unique courses with latest tee ratings.`);
  console.log(`🏌️ Prepared ${parsedRounds.length} rounds.`);

  // Write to SQLite database
  const db = new Database(dbPath);
  const schema = fs.readFileSync('schema.sql', 'utf8');
  db.run(schema);

  // Clear existing mock data
  db.run('DELETE FROM rounds;');
  db.run('DELETE FROM courses;');
  db.run('DELETE FROM deleted_rounds;');
  db.run('DELETE FROM deleted_courses;');

  const insertRound = db.prepare(`
    INSERT INTO rounds (id, data, created_at, updated_at)
    VALUES ($id, $data, $created_at, $updated_at)
  `);

  const insertCourse = db.prepare(`
    INSERT INTO courses (id, data, created_at, updated_at)
    VALUES ($id, $data, $created_at, $updated_at)
  `);

  const tx = db.transaction(() => {
    for (const c of finalCourses) {
      insertCourse.run({
        $id: c.id,
        $data: JSON.stringify(c),
        $created_at: c.created_at,
        $updated_at: c.updated_at
      });
    }

    for (const r of parsedRounds) {
      insertRound.run({
        $id: r.id,
        $data: JSON.stringify(r),
        $created_at: r.created_at,
        $updated_at: r.updated_at
      });
    }
  });

  tx();

  console.log(`✅ Successfully imported into ${dbPath}!`);

  return {
    roundsCount: parsedRounds.length,
    coursesCount: finalCourses.length
  };
}

if (import.meta.main) {
  importCsvToDatabase();
}
