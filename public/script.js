document.addEventListener('DOMContentLoaded', () => {
    const reservationForm = document.getElementById('reservation-form');
    const calendarEl = document.getElementById('calendar');

    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        events: '/api/reservations',
        eventDataTransform: function(eventData) {
            // Map database fields to FullCalendar fields
            return {
                title: eventData.Titel,
                start: eventData.Start_Date_Time,
                end: eventData.End_Date_Time,
                extendedProps: {
                    location: eventData.Locatie,
                    // Store original ISO strings for the delete function
                    start_utc: eventData.Start_Date_Time,
                    end_utc: eventData.End_Date_Time
                }
            };
        },
        eventClick: function(info) {
            const { title, extendedProps } = info.event;
            const { location, start_utc, end_utc } = extendedProps;
            
            if (confirm(`Wil je de reservering "${title}" verwijderen?`)) {
                deleteReservation(start_utc, end_utc, location);
            }
        },
        eventContent: function(arg) {
            // Custom render to include location in the event display
            let italicEl = document.createElement('i');
            italicEl.textContent = arg.event.extendedProps.location;

            let arrayOfDomNodes = [ document.createElement('div').appendChild(italicEl) ];
            return { domNodes: arrayOfDomNodes }
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
        const data = {
            contactperson: formData.get('contactperson'),
            email: formData.get('email'),
            title: formData.get('title'),
            // Get values and format them for the backend
            'start-date': formData.get('start-date').replace('T', ' '),
            'end-date': formData.get('end-date').replace('T', ' '),
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
                alert(`Fout: ${result.error}`);
            }
        } catch (error) {
            console.error('Fout bij aanmaken:', error);
            alert('Kon de reservering niet aanmaken.');
        }
    });
});
