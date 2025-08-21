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

// DELETE een reservering
app.delete('/api/reservations', (req: Request, res: Response) => {
  const { start, end, locatie } = req.query;
  const contactpersoon = req.headers['x-contact-person'];
  if (!contactpersoon || !start || !end || !locatie) {
    return res.status(400).json({ error: 'Alle velden zijn verplicht.' });
  }

  // Verifieer contactpersoon
  connection.query(
    `SELECT Contactpersoon FROM locatiereserveren
     WHERE Start_DT = ? AND End_DT = ? AND Locatie = ?`,
  [start, end, locatie],
    (error: Error | null, rows: any) => {
      if (error) {
        console.error('MySQL DELETE error:', error);
        return res.status(500).json({ error: error.message });
      }
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Reservering niet gevonden.' });
      }
      if (rows[0].Contactpersoon !== contactpersoon) {
        return res.status(403).json({ error: 'Verificatie van contactpersoon mislukt.' });
      }

      // Verwijder reservering
      connection.query(
        `DELETE FROM locatiereserveren
         WHERE Start_DT = ? AND End_DT = ? AND Locatie = ?`,
  [start, end, locatie],
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
