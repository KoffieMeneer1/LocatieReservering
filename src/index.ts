import express, { Request, Response } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import mysql from 'mysql2';

dotenv.config();

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true'
    ? { rejectUnauthorized: false }
    : undefined
});


connection.connect((err: Error | null) => {
  if (err) {
    console.error('Error connecting:', err.stack);
    return;
  }
  console.log('Connected as id', connection.threadId);
});

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.json());

// GET alle reserveringen
app.get('/api/reservations', (req: Request, res: Response) => {
  connection.query(
    'SELECT Titel, Start_DT, End_DT, Locatie, Contactpersoon FROM locatiereserveren',
    (error: Error | null, results: any) => {
      if (error) {
        console.error('MySQL GET error:', error);
        return res.status(500).json({ error: error.message });
      }
      res.json(results);
    }
  );
});

// POST een nieuwe reservering
app.post('/api/reservations', (req: Request, res: Response) => {
  const { Contactpersoon, Titel, Start_DT, End_DT, Locatie } = req.body;
  if (!Contactpersoon || !Titel || !Start_DT || !End_DT || !Locatie) {
    return res.status(400).json({ error: 'Alle velden zijn verplicht.' });
  }

  // Controleer op overlappende reserveringen
  connection.query(
    `SELECT Titel FROM locatiereserveren
     WHERE Locatie = ? AND (
       (Start_DT <= ? AND End_DT >= ?) OR
       (Start_DT <= ? AND End_DT >= ?) OR
       (Start_DT >= ? AND End_DT <= ?)
     )`,
  [Locatie, End_DT, End_DT, Start_DT, Start_DT, Start_DT, End_DT],
    (error: Error | null, overlap: any) => {
      if (error) {
        console.error('MySQL overlap error:', error);
        return res.status(500).json({ error: error.message });
      }
      if (overlap.length > 0) {
        return res.status(409).json({ error: 'Deze locatie & tijd is al gereserveerd, kies een andere tijd of locatie.' });
      }

      // Voeg reservering toe
      connection.query(
        `INSERT INTO locatiereserveren (Contactpersoon, Titel, Start_DT, End_DT, Locatie)
         VALUES (?, ?, ?, ?, ?)`,
  [Contactpersoon, Titel, Start_DT, End_DT, Locatie],
        (error: Error | null) => {
          if (error) {
            console.error('MySQL POST error:', error);
            return res.status(500).json({ error: error.message });
          }
          res.status(201).json({ message: 'Reservering aangemaakt.' });
        }
      );
    }
  );
});


app.delete('/api/reservations', (req: Request, res: Response) => {
  const start = req.query.Start_DT as string;
  const end = req.query.End_DT as string;
  const locatie = req.query.Locatie as string;
  // Extract user identity from Bearer token if present
  const auth = req.headers['authorization'] as string | undefined;
  let contactpersoonFromToken: string | undefined;
  if (auth && auth.startsWith('Bearer ')) {
    try {
      const token = auth.substring('Bearer '.length);
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'));
  // Prefer the human/display name (given_name or name) before the short preferred_username
  contactpersoonFromToken = (payload.given_name || payload.name || payload.preferred_username || payload.email) as string | undefined;
    } catch (e) {
      console.warn('Failed to parse JWT for authorization');
    }
  }

  const headerContactPerson = req.headers['x-contact-person'] as string | undefined;
  console.log('Verzoek ontvangen voor DELETE:', {
    start,
    end,
    locatie,
    contactpersoonFromToken,
    headerContactPerson
  });

  if ((!contactpersoonFromToken && !req.headers['x-contact-person']) || !start || !end || !locatie) {
    return res.status(400).json({ error: 'Alle velden zijn verplicht.' });
  }

  // Zoek reservering op PK
  connection.query(
    `SELECT * FROM locatiereserveren
     WHERE Locatie = ? AND Start_DT = ? AND End_DT = ?`,
    [locatie, start, end],
    (error: Error | null, rows: any) => {
      if (error) {
        console.error('MySQL DELETE zoek error:', error);
        return res.status(500).json({ error: error.message });
      }
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Reservering niet gevonden.' });
      }

      // Decide which identifier to use: prefer token-derived human name, fallback to header
      const expectedContact = (contactpersoonFromToken || (req.headers['x-contact-person'] as string) || '').toString().trim();
      // Match case-insensitively and ignore surrounding whitespace so the DB value and token claim can differ in case/spacing
      const match = rows.find((row: any) => ((row.Contactpersoon || '').toString().trim().toLowerCase()) === expectedContact.toLowerCase());
      if (!match) {
        return res.status(403).json({ error: 'Verificatie van contactpersoon mislukt.' });
      }

      // Verwijder reservering
      connection.query(
        `DELETE FROM locatiereserveren
         WHERE Start_DT = ? AND End_DT = ? AND Locatie = ? AND Contactpersoon = ?`,
        [match.Start_DT, match.End_DT, match.Locatie, match.Contactpersoon],
        (error: Error | null) => {
          if (error) {
            console.error('MySQL DELETE error:', error);
            return res.status(500).json({ error: error.message });
          }
          res.status(204).send();
        }
      );
    }
  );
});

app.get('/health', (req: Request, res: Response) => {
  res.status(200).send('OK');
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server draait op http://0.0.0.0:${port}`);
});
