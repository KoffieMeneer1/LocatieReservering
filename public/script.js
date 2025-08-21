document.addEventListener('DOMContentLoaded', () => {
    const reservationForm = document.getElementById('reservation-form');
    const calendarEl = document.getElementById('calendar');

    const calendar = new FullCalendar.Calendar(calendarEl, {
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
        eventDataTransform: function(eventData) {
            // Map database fields to FullCalendar fields
            return {
                title: eventData.Titel,
                start: eventData.Start_Date_Time,
                end: eventData.End_Date_Time,
                resourceId: eventData.Locatie, // Assign event to a resource
                extendedProps: {
                    // Store original ISO strings for the delete function
                    start_utc: eventData.Start_Date_Time,
                    end_utc: eventData.End_Date_Time,
                    location: eventData.Locatie
                }
            };
        },
        eventClick: function(info) {
            const { title, extendedProps, start, end } = info.event;
            const { location, start_utc, end_utc } = extendedProps;
            
            // Verwijder eventuele bestaande kaarten
            const existingCard = document.querySelector('.reservation-card');
            if (existingCard) {
                document.body.removeChild(existingCard);
            }

            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };

            const cardContent = `
                <h3>${title}</h3>
                <p><strong>Start:</strong> ${start.toLocaleString('nl-NL', options)}</p>
                <p><strong>Eind:</strong> ${end.toLocaleString('nl-NL', options)}</p>
                <p><strong>Locatie:</strong> ${location}</p>
            `;

            const card = document.createElement('div');
            card.className = 'reservation-card';
            card.innerHTML = cardContent;

            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'card-buttons';

            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Verwijderen';
            deleteButton.onclick = () => {
                // De deleteReservation functie vraagt om bevestiging en contactpersoon
                deleteReservation(start_utc, end_utc, location);
                document.body.removeChild(card);
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

    // Functie om een reservering te verwijderen
    const deleteReservation = async (start, end, location) => {
        const contactpersoon = prompt('Voer de naam van de contactpersoon in om te bevestigen:');
        if (!contactpersoon) {
            alert('Verwijderen geannuleerd.');
            return;
        }

        try {
            // The start/end times are already ISO strings from the event data
            const params = new URLSearchParams({ start, end, location });
            const response = await fetch(`/api/reservations?${params.toString()}`, {
                method: 'DELETE',
                headers: {
                    'x-contact-person': contactpersoon
                }
            });

            if (response.ok) {
                alert('Reservering succesvol verwijderd.');
                calendar.refetchEvents(); // Herlaad de evenementen
            } else {
                const result = await response.json();
                alert(`Fout: ${result.error}`);
            }
        } catch (error) {
            console.error('Fout bij verwijderen:', error);
            alert('Kon de reservering niet verwijderen.');
        }
    };

    // Event listener voor het toevoegen van een reservering
    reservationForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(reservationForm);
        
        // Converteer de lokale datumtijd naar volledige ISO strings (UTC)
        const startDate = new Date(formData.get('start-date')).toISOString();
        const endDate = new Date(formData.get('end-date')).toISOString();

        const data = {
            contactperson: formData.get('contactperson'),
            title: formData.get('title'),
            Start_DT: startDate,
            End_DT: endDate,
            location: formData.get('location')
        };


        try {
            const response = await fetch('/api/reservations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                alert('Reservering succesvol aangemaakt!');
                reservationForm.reset();
                calendar.refetchEvents(); // Herlaad de evenementen
            } else {
                const result = await response.json();
                if (result.error && result.error.includes('duplicate key value violates unique constraint')) {
                    alert('Fout: Deze locatie & tijd is al gereserveerd, kies een andere tijd of locatie.');
                } else {
                    alert(`Fout: ${result.error}`);
                }
            }
        } catch (error) {
            console.error('Fout bij aanmaken:', error);
            alert('Kon de reservering niet aanmaken.');
        }
    });
});
