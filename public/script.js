function toMySQLDateTimeWithTZ(dateStr, timeZone = 'Europe/Amsterdam', hourCorrection = 0) {
    let date = new Date(dateStr);
    if (hourCorrection !== 0) {
        date = new Date(date.getTime() + hourCorrection * 60 * 60 * 1000);
    }
    const options = {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };

    const parts = new Intl.DateTimeFormat('nl-NL', options).formatToParts(date);
    const getPart = (type) => parts.find(p => p.type === type)?.value;

    return `${getPart('year')}-${getPart('month')}-${getPart('day')} ${getPart('hour')}:${getPart('minute')}:${getPart('second')}`;
}


    const reservationForm = document.getElementById('reservation-form');
    const calendarEl = document.getElementById('calendar');
    const welcomeEl = document.getElementById('welcome');
    const contactInput = document.getElementById('contactperson');
    const logoutBtn = document.getElementById('logout-btn');

    function fillNameFromKeycloak(){
        try{
            if(window.keycloak && window.keycloak.tokenParsed){
                const given = window.keycloak.tokenParsed.given_name || window.keycloak.tokenParsed.preferred_username || '';
                if(welcomeEl) welcomeEl.textContent = 'Welkom, ' + given;
                if(contactInput) {
                    contactInput.value = given;
                    // persist for this session so the field stays populated after creating a reservation
                    try { sessionStorage.setItem('contactperson', given); } catch (e) { /* ignore */ }
                }
                if(logoutBtn) logoutBtn.style.display = 'inline-block';
            }
        }catch(e){console.warn('Could not fill name from Keycloak', e)}
    }

    // Try immediately and also on authenticated event
    fillNameFromKeycloak();
    window.addEventListener('authenticated', fillNameFromKeycloak);

    // Logout button behavior
    if(logoutBtn){
        logoutBtn.addEventListener('click', (e)=>{
            e.preventDefault();
            if(window.keycloak){
                // redirect to loggedout page after logout
                window.keycloak.logout({ redirectUri: window.location.origin + '/loggedout.html' });
            } else {
                // fallback: just redirect
                window.location.href = '/loggedout.html';
            }
        });
    }

    const calendar = new FullCalendar.Calendar(calendarEl, {
        timeZone: 'Europe/Amsterdam',
        schedulerLicenseKey: 'GPL-My-Project-Is-Open-Source', // Required for resource views
        initialView: 'resourceTimelineWeek',
        locale: 'nl',
        weekends: false, // Hide Saturday and Sunday
        firstDay: 1, // Start the week on Monday
        headerToolbar: {
            left: 'prev,next',
            center: 'title',
            right: 'resourceTimelineDay,resourceTimelineWeek'
        },
        buttonText: {
            resourceTimelineDay: 'dag',
            resourceTimelineWeek: 'week'
        },
        dayHeaderFormat: { weekday: 'long', month: 'numeric', day: 'numeric', omitCommas: true },
        slotLabelFormat: [
            { weekday: 'long', month: 'numeric', day: 'numeric' }, // Top level: Maandag 4/8
            { hour: '2-digit', minute: '2-digit', hour12: false } // Bottom level: 09:00
        ],
        slotMinTime: '09:00:00', // Start day at 9:00 AM
        slotMaxTime: '18:00:00', // End day at 6 PM
        height: 'auto',
        resourceAreaHeaderContent: 'Locatie',
        resources: [
            { id: 'Auditorium', title: 'Auditorium' },
            { id: 'De Windmolen 10p', title: 'De Windmolen 10p' },
            { id: 'De Kasteeltuin 8p', title: 'De Kasteeltuin 8p' },
            { id: 'De Peel 4p', title: 'De Peel 4p' },
            { id: 'Huiskamer', title: 'Huiskamer' }
        ],
        events: '/api/reservations',
        
// ISO STRING
eventDataTransform: function(eventData) {
    // Keep transformation but avoid logging full event objects to the console
    return {
        title: eventData.Titel,
        start: eventData.Start_DT,
        end: eventData.End_DT,
        resourceId: eventData.Locatie,
        extendedProps: {
            start_utc: eventData.Start_DT,
            end_utc: eventData.End_DT,
            location: eventData.Locatie,
            contactperson: eventData.Contactpersoon
        }
    };
},


eventClick: function(info) {
    const { title, extendedProps } = info.event;
    const { location, start_utc, end_utc, contactperson } = extendedProps;

    // Verwijder eventuele bestaande kaarten
    const existingCard = document.querySelector('.reservation-card');
    if (existingCard) {
        document.body.removeChild(existingCard);
    }

// Wintertijd -1, Zomertijd -2, Laatste zondag maart = zomertijd gaat in, Laatste zondag oktober = wintertijd gaat in
    const cardContent = `
        <h3>${title}</h3>
        <p><strong>Start:</strong> ${toMySQLDateTimeWithTZ(start_utc, 'Europe/Amsterdam', -2)}</p>
        <p><strong>Eind:</strong> ${toMySQLDateTimeWithTZ(end_utc, 'Europe/Amsterdam', -2)}</p>
        <p><strong>Locatie:</strong> ${location}</p>
        <p><strong>Contactpersoon:</strong> ${contactperson}</p>
    `;

    const card = document.createElement('div');
    card.className = 'reservation-card';
    card.innerHTML = cardContent;

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'card-buttons';

    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Verwijderen';
    deleteButton.onclick = async () => {
        // Use Keycloak token to authorize deletion on the server
        const ok = await deleteReservation(start_utc, end_utc, location, contactperson);
        if (ok) {
            document.body.removeChild(card);
        }
    };

    const closeButton = document.createElement('button');
    closeButton.textContent = 'Sluiten';
    closeButton.onclick = () => {
        document.body.removeChild(card);
    };

    buttonContainer.appendChild(deleteButton);
    buttonContainer.appendChild(closeButton);
    card.appendChild(buttonContainer);
    document.body.appendChild(card);
}
        });

    calendar.render();

// restore persisted contactperson on page load (if present from session)
try {
    const saved = sessionStorage.getItem('contactperson');
    if (saved && contactInput) contactInput.value = saved;
} catch (e) { /* ignore sessionStorage errors */ }

const deleteReservation = async (start, end, location, contactpersoon) => {
    if (!contactpersoon || !start || !end || !location ) {
        alert('Verwijderen geannuleerd. Ontbrekende gegevens.');
        return false;
    }

    // Wintertijd: -2, Zomertijd -1, Laatste zondag maart = zomertijd gaat in, Laatste zondag oktober = wintertijd gaat in
    const startDate = new Date(start);
    const endDate = new Date(end);
    const startCorrected = new Date(startDate.getTime() - 2 * 60 * 60 * 1000);
    const endCorrected = new Date(endDate.getTime() - 2 * 60 * 60 * 1000);

    // Format naar MySQL datetime in juiste tijdzone
    const startMySQL = toMySQLDateTimeWithTZ(startCorrected);
    const endMySQL = toMySQLDateTimeWithTZ(endCorrected);

    // Use PK column names for backend
    const params = new URLSearchParams({
        Start_DT: startMySQL,
        End_DT: endMySQL,
        Locatie: location,
    });

    try {
        const headers = {};
        if (window.keycloak && window.keycloak.token) {
            // send token in Authorization header but avoid printing it anywhere
            headers['Authorization'] = `Bearer ${window.keycloak.token}`;
        }
        // include contact person to help server-side verification if token parsing fails
        if (contactpersoon) headers['x-contact-person'] = contactpersoon;

        const response = await fetch(`/api/reservations?${params.toString()}`, {
            method: 'DELETE',
            headers
        });

        if (response.ok) {
            alert('Reservering succesvol verwijderd.');
            calendar.refetchEvents();
            return true;
        } else {
            const result = await response.json();
            alert(`Fout: ${result.error}`);
            return false;
        }
    } catch (error) {
        // suppress detailed error in console to avoid leaking internals
        alert('Kon de reservering niet verwijderen.');
        return false;
    }
};


    // Event listener voor het toevoegen van een reservering
    reservationForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(reservationForm);

        const startRaw = formData.get('start-date');
        const endRaw = formData.get('end-date');
        const locatie = formData.get('location');
        const titel = formData.get('title');
        const contact = formData.get('contactperson');

        if (!startRaw || !endRaw || !locatie || !titel || !contact) {
            alert('Alle velden zijn verplicht.');
            return;
        }

        const startObj = new Date(startRaw);
        const endObj = new Date(endRaw);

        // 1) start must be before end
        if (startObj.getTime() >= endObj.getTime()) {
            alert('Starttijd moet vroeger zijn dan eindtijd.');
            return;
        }

        // 2) enforce per-day business hours 09:00 - 18:00 (start and end must be within these bounds)
        const isWithinBusinessHours = (d) => {
            const h = d.getHours();
            const m = d.getMinutes();
            if (h < 9) return false;
            if (h > 18) return false;
            if (h === 18 && m > 0) return false; // max 18:00
            return true;
        };

        if (!isWithinBusinessHours(startObj) || !isWithinBusinessHours(endObj)) {
            alert('Tijden moeten tussen 09:00 en 18:00 liggen (max 18:00).');
            return;
        }

        const startDate = toMySQLDateTimeWithTZ(startObj);
        const endDate = toMySQLDateTimeWithTZ(endObj);

        const data = {
            Contactpersoon: contact,
            Titel: titel,
            Start_DT: startDate,
            End_DT: endDate,
            Locatie: locatie
        };

        try {
            const response = await fetch('/api/reservations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': window.keycloak && window.keycloak.token ? `Bearer ${window.keycloak.token}` : undefined
                },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                alert('Reservering succesvol aangemaakt!');
                try { sessionStorage.setItem('contactperson', contact); } catch (e) {}
                const contactVal = contactInput ? contactInput.value : '';
                reservationForm.reset();
                if (contactInput) contactInput.value = contactVal;
                calendar.refetchEvents();
            } else {
                const result = await response.json();
                if (result.error && result.error.includes('duplicate key value violates unique constraint')) {
                    alert('Fout: Deze locatie & tijd is al gereserveerd, kies een andere tijd of locatie.');
                } else {
                    alert(`Fout: ${result.error}`);
                }
            }
        } catch (error) {
            alert('Kon de reservering niet aanmaken.');
        }
    });