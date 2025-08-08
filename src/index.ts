import express from 'express';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

// Statische bestanden serveren vanuit de 'public' map
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.json());

// Supabase initialisatie
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// API routes

// GET alle reserveringen
app.get('/api/reservations', async (req, res) => {
    const { data, error } = await supabase.from('Reserveringen').select('Titel, Start_Date_Time, End_Date_Time, Locatie');
    if (error) {
        console.error('Supabase GET error:', error);
        return res.status(500).json({ error: error.message });
    }
    res.json(data);
});

// POST een nieuwe reservering
app.post('/api/reservations', async (req, res) => {
    console.log('Received POST request with body:', req.body);
    const { contactperson, email, title, 'start-date': startDate, 'end-date': endDate, location } = req.body;

    // Valideer verplichte velden
    if (!contactperson || !title || !startDate || !endDate || !location) {
        return res.status(400).json({ error: 'Alle velden zijn verplicht.' });
    }

    // Valideer de boekingstijd
    const start = new Date(startDate);
    const end = new Date(endDate);
    const startDay = start.getDay();
    const startHour = start.getHours();
    const endHour = end.getHours();
    const endMinutes = end.getMinutes();

    if (startDay === 0 || startDay === 6) { // 0 = Zondag, 6 = Zaterdag
        return res.status(400).json({ error: 'Reserveringen zijn alleen toegestaan op weekdagen en overdag.' });
    }

    if (startHour < 9 || endHour > 18 || (endHour === 18 && endMinutes > 0)) {
        return res.status(400).json({ error: 'Reserveringen zijn alleen toegestaan tussen 09:00 en 18:00.' });
    }

    // Controleer op overlappende reserveringen
    const { data: existingReservations, error: overlapError } = await supabase
        .from('Reserveringen')
        .select('Titel')
        .eq('Locatie', location)
        .or(`and(Start_Date_Time.lte.${endDate},End_Date_Time.gte.${endDate}),and(Start_Date_Time.lte.${startDate},End_Date_Time.gte.${startDate}),and(Start_Date_Time.gte.${startDate},End_Date_Time.lte.${endDate})`);

    if (overlapError) {
        console.error('Error checking for overlapping reservations:', overlapError);
        return res.status(500).json({ error: 'Fout bij het controleren op bestaande reserveringen.' });
    }

    if (existingReservations && existingReservations.length > 0) {
        return res.status(409).json({ error: 'Deze locatie & tijd is al gereserveerd, kies een andere tijd of locatie.' });
    }

    // Maak de reservering direct in de Reserveringen tabel
    const { data: reservation, error: reservationError } = await supabase
        .from('Reserveringen')
        .insert([
            { 
                Contactpersoon: contactperson, 
                E_mail: email,
                Titel: title,
                Start_Date_Time: new Date(startDate), 
                End_Date_Time: new Date(endDate),
                Locatie: location 
            }
        ])
        .select()
        .single();

    if (reservationError) {
        return res.status(500).json({ error: reservationError.message });
    }

    res.status(201).json(reservation);
});

// DELETE een reservering
app.delete('/api/reservations', async (req, res) => {
    const { start, end, location } = req.query;
    const contactperson = req.headers['x-contact-person'] as string;

    if (!contactperson) {
        return res.status(400).json({ error: 'Contactpersoon naam is verplicht voor verificatie.' });
    }
    if (!start || !end || !location) {
        return res.status(400).json({ error: 'Starttijd, eindtijd en locatie zijn verplicht om een reservering te identificeren.' });
    }

    // Bouw de query om de specifieke reservering te vinden
    const matchConditions = {
        Start_Date_Time: start,
        End_Date_Time: end,
        Locatie: location
    };

    // Verifieer eerst de contactpersoon
    const { data: reservation, error: fetchError } = await supabase
        .from('Reserveringen')
        .select('Contactpersoon')
        .match(matchConditions)
        .single();

    if (fetchError || !reservation) {
        return res.status(404).json({ error: 'Reservering niet gevonden.' });
    }

    if (reservation.Contactpersoon !== contactperson) {
        return res.status(403).json({ error: 'Verificatie van contactpersoon mislukt.' });
    }

    // Verwijder de reservering
    const { error: deleteError } = await supabase
        .from('Reserveringen')
        .delete()
        .match(matchConditions);

    if (deleteError) {
        return res.status(500).json({ error: deleteError.message });
    }

    res.status(204).send();
});


app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server draait op http://0.0.0.0:${port}`);
});
