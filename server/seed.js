const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Venue = require('./models/Venue');
const Match = require('./models/Match');
const MatchComment = require('./models/MatchComment');

const seedData = async () => {
  const demoDate = (offset) => new Date(Date.now() + (offset * 86400000) + 19800000).toISOString().slice(0, 10);
  try {
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      console.log('Database already populated with initial data.');
      return;
    }

    console.log('Seeding rich initial Football Passport & Venue sample data...');

    const salt = await bcrypt.genSalt(10);
    const defaultPassword = await bcrypt.hash('password123', salt);

    // 1. Seed Venue Owners & Players
    const owner1 = await User.create({
      name: 'Rajesh Sharma (Turf Owner)',
      email: 'owner@turf.com',
      password: defaultPassword,
      role: 'owner',
      location: 'Koramangala, Bangalore',
      bio: 'Owner of HotFut Turf Arena & Sportzone Hub.'
    });

    const owner2 = await User.create({
      name: 'Priya Mehta (Arena Owner)',
      email: 'priya@turf.com',
      password: defaultPassword,
      role: 'owner',
      location: 'Jayanagar, Bangalore',
      bio: 'Founder of Turf Town & FC Whitefield Arena.'
    });

    const player1 = await User.create({
      name: 'Rohan Verma',
      email: 'rohan@gmail.com',
      password: defaultPassword,
      role: 'player',
      position: 'FW',
      experienceLevel: 'advanced',
      preferredFoot: 'Right',
      skills: { pace: 88, passing: 79, shooting: 85, defending: 55, stamina: 82 },
      bio: 'Striker with sharp finishing. Love high-intensity 5v5 weekend matches.',
      location: 'Koramangala, Bangalore',
      availability: 'Friday Evenings & Sundays',
      stats: { matchesPlayed: 28, tournamentsWon: 4, motmCount: 7, gearBoughtSold: 5 },
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400'
    });

    const player2 = await User.create({
      name: 'Arjun Nair',
      email: 'arjun@gmail.com',
      password: defaultPassword,
      role: 'player',
      position: 'MF',
      experienceLevel: 'pro',
      preferredFoot: 'Left',
      skills: { pace: 82, passing: 92, shooting: 80, defending: 76, stamina: 90 },
      bio: 'Playmaker box-to-box midfielder. Accurate long passes & vision.',
      location: 'Indiranagar, Bangalore',
      availability: 'Weekdays 7 PM onwards',
      stats: { matchesPlayed: 45, tournamentsWon: 8, motmCount: 12, gearBoughtSold: 8 },
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400'
    });

    const player3 = await User.create({
      name: 'Vikram Singh',
      email: 'vikram@gmail.com',
      password: defaultPassword,
      role: 'player',
      position: 'DF',
      experienceLevel: 'intermediate',
      preferredFoot: 'Right',
      skills: { pace: 70, passing: 74, shooting: 62, defending: 89, stamina: 84 },
      bio: 'Solid center-back. Strong tackling and interception specialist.',
      location: 'HSR Layout, Bangalore',
      availability: 'Saturday Mornings',
      stats: { matchesPlayed: 19, tournamentsWon: 1, motmCount: 4, gearBoughtSold: 2 },
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400'
    });

    const player4 = await User.create({
      name: 'Karan Patel',
      email: 'karan@gmail.com',
      password: defaultPassword,
      role: 'player',
      position: 'GK',
      experienceLevel: 'advanced',
      preferredFoot: 'Right',
      skills: { pace: 65, passing: 70, shooting: 45, defending: 91, stamina: 78 },
      bio: 'Reflex goalkeeper. Always organizing defense from the back.',
      location: 'Koramangala, Bangalore',
      availability: 'All days',
      stats: { matchesPlayed: 34, tournamentsWon: 5, motmCount: 9, gearBoughtSold: 3 },
      avatarUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400'
    });

    const player5 = await User.create({
      name: 'Sameer Khan',
      email: 'sameer@gmail.com',
      password: defaultPassword,
      role: 'player',
      position: 'FW',
      experienceLevel: 'pro',
      preferredFoot: 'Left',
      skills: { pace: 94, passing: 81, shooting: 90, defending: 48, stamina: 86 },
      bio: 'Winger with rapid pace & dribbling. Looking for competitive night leagues.',
      location: 'Whitefield, Bangalore',
      availability: 'Weekends & Late Nights',
      stats: { matchesPlayed: 52, tournamentsWon: 9, motmCount: 15, gearBoughtSold: 10 },
      avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400'
    });

    const player6 = await User.create({
      name: 'Ananya Roy',
      email: 'ananya@gmail.com',
      password: defaultPassword,
      role: 'player',
      position: 'MF',
      experienceLevel: 'intermediate',
      preferredFoot: 'Ambidextrous',
      skills: { pace: 78, passing: 85, shooting: 74, defending: 68, stamina: 82 },
      bio: 'Central midfielder with great composure and distribution skills.',
      location: 'Jayanagar, Bangalore',
      availability: 'Saturday Evenings',
      stats: { matchesPlayed: 22, tournamentsWon: 2, motmCount: 5, gearBoughtSold: 4 },
      avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400'
    });

    // 2. Seed 6 Rich Turf Venues
    const venue1 = await Venue.create({
      name: 'HotFut Turf Arena',
      location: '80 Feet Road, Koramangala, Bangalore',
      area: 'Koramangala',
      pricePerHour: 1500,
      sportType: '5-a-side',
      rating: 4.9,
      photos: [
        'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800',
        'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800'
      ],
      description: 'FIFA quality artificial turf with high-intensity LED floodlights, sound system, and chilled water.',
      amenities: ['LED Floodlights', 'Bibs Provided', 'Changing Rooms', 'Drinking Water', 'Spectator Seating'],
      ownerId: owner1._id
    });

    const venue2 = await Venue.create({
      name: 'Sportzone Football Hub',
      location: '100 Feet Road, Indiranagar, Bangalore',
      area: 'Indiranagar',
      pricePerHour: 1800,
      sportType: '7-a-side',
      rating: 4.8,
      photos: [
        'https://images.unsplash.com/photo-1575361204480-aadea25e6e68?w=800',
        'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800'
      ],
      description: 'Spacious 7v7 rubber-infill turf field perfect for corporate and weekend tournament matches.',
      amenities: ['7-a-side Turf', 'Locker Facility', 'Cafeteria', 'Floodlights'],
      ownerId: owner1._id
    });

    const venue3 = await Venue.create({
      name: 'CaughtOffside HSR Arena',
      location: 'Sector 2, HSR Layout, Bangalore',
      area: 'HSR Layout',
      pricePerHour: 1200,
      sportType: '5-a-side',
      rating: 4.7,
      photos: [
        'https://images.unsplash.com/photo-1518604666860-9ed391f76460?w=800'
      ],
      description: 'Popular weekend turf with high rebound netting and free football rental.',
      amenities: ['Rebound Netting', 'Free Parking', 'Bibs & Balls', 'Restrooms'],
      ownerId: owner1._id
    });

    const venue4 = await Venue.create({
      name: 'FC Whitefield Turf & Arena',
      location: 'ITPL Main Road, Whitefield, Bangalore',
      area: 'Whitefield',
      pricePerHour: 2000,
      sportType: '11-a-side',
      rating: 4.9,
      photos: [
        'https://images.unsplash.com/photo-1551958219-acbc608c6377?w=800'
      ],
      description: 'Full-sized 11v11 artificial turf pitch equipped for official league tournaments and 9v9 matches.',
      amenities: ['11-a-side Pitch', 'Floodlights', 'Shower Rooms', 'First Aid Box'],
      ownerId: owner2._id
    });

    const venue5 = await Venue.create({
      name: 'Turf Town Jayanagar',
      location: '4th Block, Jayanagar, Bangalore',
      area: 'Jayanagar',
      pricePerHour: 1400,
      sportType: '5-a-side',
      rating: 4.6,
      photos: [
        'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=800'
      ],
      description: 'Indoor enclosed box turf with shock-pad underlayment for high protection during fast games.',
      amenities: ['Indoor Netting', 'AC Lounge', 'Free Refreshments'],
      ownerId: owner2._id
    });

    const venue6 = await Venue.create({
      name: 'The Dugout Electronic City',
      location: 'Phase 1, Electronic City, Bangalore',
      area: 'Electronic City',
      pricePerHour: 1300,
      sportType: 'Box Cricket & Football',
      rating: 4.7,
      photos: [
        'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800'
      ],
      description: 'Hybrid multi-sport turf field optimized for both box cricket and fast-paced 5v5 football.',
      amenities: ['Multi-Sport Netting', 'Night Lighting', 'Free Parking'],
      ownerId: owner2._id
    });

    // 3. Seed Open Hosted Matches (Upcoming & Past History)
    const match1 = await Match.create({
      hostId: player1._id,
      venueId: venue1._id,
      date: demoDate(1),
      timeSlot: '07:00 PM - 08:00 PM',
      format: '5v5',
      totalSpots: 10,
      pricePerSpot: 150,
      notes: 'Competitive 5v5 demo match! Need 3 more mid/defenders.',
      acceptedPlayers: [player1._id, player2._id, player3._id, player4._id],
      pendingRequests: []
    });

    const match2 = await Match.create({
      hostId: player2._id,
      venueId: venue2._id,
      date: demoDate(3),
      timeSlot: '08:00 PM - 09:00 PM',
      format: '7v7',
      totalSpots: 14,
      pricePerSpot: 200,
      notes: '7v7 open game at Sportzone. Good stamina required!',
      acceptedPlayers: [player2._id, player3._id, player5._id],
      pendingRequests: [player1._id]
    });

    const match3 = await Match.create({
      hostId: player3._id,
      venueId: venue3._id,
      date: demoDate(5),
      timeSlot: '06:00 PM - 07:00 PM',
      format: '5v5',
      totalSpots: 10,
      pricePerSpot: 140,
      notes: '5v5 evening match under LED floodlights.',
      acceptedPlayers: [player3._id, player5._id],
      pendingRequests: []
    });

    const match4 = await Match.create({
      hostId: player4._id,
      venueId: venue4._id,
      date: demoDate(7),
      timeSlot: '09:00 PM - 10:00 PM',
      format: '11-a-side',
      totalSpots: 22,
      pricePerSpot: 250,
      notes: 'Full field 11v11 match! Referees included.',
      acceptedPlayers: [player4._id, player1._id, player2._id],
      pendingRequests: []
    });

    // Seed Past Completed / Expired Matches
    const pastMatch1 = await Match.create({
      hostId: player1._id,
      venueId: venue1._id,
      date: demoDate(-3),
      timeSlot: '07:00 PM - 08:00 PM',
      format: '5v5',
      totalSpots: 10,
      pricePerSpot: 150,
      notes: 'Past weekend competitive 5v5 clash.',
      acceptedPlayers: [player1._id, player2._id, player3._id, player4._id, player5._id],
      pendingRequests: []
    });

    const pastMatch2 = await Match.create({
      hostId: player2._id,
      venueId: venue2._id,
      date: demoDate(-1),
      timeSlot: '08:00 PM - 09:00 PM',
      format: '7v7',
      totalSpots: 14,
      pricePerSpot: 200,
      notes: 'Past Sunday 7v7 showdown.',
      acceptedPlayers: [player2._id, player1._id, player3._id, player6._id],
      pendingRequests: []
    });

    // 4. Seed Notice Board Comments for Match 1
    await MatchComment.create({
      matchId: match1._id,
      userId: player1._id,
      userName: 'Rohan Verma',
      userPosition: 'FW',
      commentText: 'Hey team! I have booked the turf slot. Please reach 10 mins before 7 PM.'
    });

    await MatchComment.create({
      matchId: match1._id,
      userId: player2._id,
      userName: 'Arjun Nair',
      userPosition: 'MF',
      commentText: 'Awesome! I will bring red and blue bibs for teams.'
    });

    console.log('Rich sample data seeded successfully!');
  } catch (error) {
    throw error;
  }
};

module.exports = seedData;
