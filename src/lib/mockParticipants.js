export function generateMockParticipants() {
  const firstNames = [
    "Alex",
    "Jordan",
    "Taylor",
    "Casey",
    "Riley",
    "Morgan",
    "Sam",
    "Jamie",
    "Quinn",
    "Avery",
  ];
  const lastNames = [
    "Smith",
    "Johnson",
    "Williams",
    "Brown",
    "Jones",
    "Garcia",
    "Miller",
    "Davis",
    "Rodriguez",
    "Martinez",
  ];

  const generateName = () =>
    `${firstNames[Math.floor(Math.random() * 10)]} ${lastNames[Math.floor(Math.random() * 10)]}`;

  const participants = [];
  for (let i = 0; i < 45; i++) {
    participants.push({
      id: `audio-user-${i}`,
      name: generateName(),
      hasVideo: false,
      isMuted: Math.random() > 0.2,
    });
  }
  return participants.sort((a, b) => a.name.localeCompare(b.name));
}
