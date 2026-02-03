const morningGreetings = [
  'Rise and shine',
  'Top of the morning',
  'Wakey wakey',
  'Hello sunshine',
  'Look who\'s up',
  'Morning, superstar',
  'Ready to conquer today',
  'Coffee time',
  'Bright-eyed and bushy-tailed',
  'Good morrow',
  'The early bird catches',
  'Carpe diem',
  'You\'re up before the sun',
  'Morning glory',
  'Another day, another adventure',
];

const afternoonGreetings = [
  'Hey there',
  'Afternoon delight',
  'Halfway through',
  'Still crushing it',
  'Keep on keepin\' on',
  'How goes the day',
  'Afternoon vibes',
  'Making things happen',
  'Good day',
  'Well met',
  'The game is afoot',
  'Onwards and upwards',
  'May the force be with you',
  'Adventure awaits',
  'What a time to be alive',
];

const eveningGreetings = [
  'Good evening',
  'Evening, friend',
  'Winding down',
  'Home stretch',
  'Almost done',
  'Evening already',
  'Hope today was good',
  'Settling in',
  'As the sun sets',
  'Time flies',
  'What a day',
  'Made it through another one',
  'Twilight time',
  'The stars are coming out',
];

const nightGreetings = [
  'Burning the midnight oil',
  'Night owl mode',
  'Still awake',
  'The world is quiet',
  'Sweet dreams soon',
  'Starlight hours',
  'Late night crew',
  'The witching hour approaches',
  'While the world sleeps',
  'To sleep, perchance to dream',
  'Goodnight, moon',
  'The night is young',
  'What brings you here at this hour',
];

export function getGreeting(): string {
  const hour = new Date().getHours();

  // Use a seed based on the day so it doesn't change on every render
  const daySeed = new Date().toDateString();
  const pseudoRandom = (arr: string[]): string => {
    if (arr.length === 0) return 'Hello';
    let hash = 0;
    for (let i = 0; i < daySeed.length; i++) {
      hash = ((hash << 5) - hash) + daySeed.charCodeAt(i);
      hash = hash & hash;
    }
    return arr[Math.abs(hash) % arr.length]!;
  };

  if (hour >= 5 && hour < 12) {
    return pseudoRandom(morningGreetings);
  }
  if (hour >= 12 && hour < 17) {
    return pseudoRandom(afternoonGreetings);
  }
  if (hour >= 17 && hour < 21) {
    return pseudoRandom(eveningGreetings);
  }
  return pseudoRandom(nightGreetings);
}
