import { Router } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../services/database/prismaClient.js';
import { Role } from '@prisma/client';

const router = Router();

function validatePhone(phone?: string): boolean {
  if (!phone) return true;
  return /^\d{10}$/.test(phone);
}

// Get all users
router.get('/', async (req, res) => {
  try {
    const users = await prisma.userProfile.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new user profile
router.post('/', async (req, res) => {
  try {
    const { username, password, name, role, email, phoneNumber } = req.body;

    if (!username) return res.status(400).json({ error: 'Username is required' });

    const existing = await prisma.userProfile.findUnique({ where: { username } });
    if (existing) return res.status(409).json({ error: 'Username already exists' });

    if (email) {
      const emailExists = await prisma.userProfile.findUnique({ where: { email } });
      if (emailExists) return res.status(409).json({ error: 'Email already exists' });
    }

    if (!validatePhone(phoneNumber)) {
      return res.status(400).json({ error: 'Phone number must be exactly 10 digits' });
    }

    const user = await prisma.userProfile.create({
      data: {
        username,
        password: password ? await bcrypt.hash(password, 10) : await bcrypt.hash('changeme', 10),
        name: name || username,
        email,
        phoneNumber,
        role: role as Role || 'VIEWER'
      }
    });

    const { password: _, ...userWithoutPassword } = user;
    res.status(201).json(userWithoutPassword);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update a user profile (all editable fields)
router.put('/:id', async (req, res) => {
  try {
    const { name, email, phoneNumber, password, role, pageAccess, profilePicture, isActive } = req.body;
    const userId = req.params.id;

    const existing = await prisma.userProfile.findUnique({ where: { id: userId } });
    if (!existing) return res.status(404).json({ error: 'User not found' });

    // Validate email uniqueness if changed
    if (email && email !== existing.email) {
      const emailExists = await prisma.userProfile.findUnique({ where: { email } });
      if (emailExists) return res.status(409).json({ error: 'Email already in use' });
    }

    // Validate phone
    if (!validatePhone(phoneNumber)) {
      return res.status(400).json({ error: 'Phone number must be exactly 10 digits' });
    }

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;
    if (phoneNumber !== undefined) data.phoneNumber = phoneNumber;
    if (role !== undefined) data.role = role as Role;
    if (pageAccess !== undefined) data.pageAccess = pageAccess;
    if (profilePicture !== undefined) data.profilePicture = profilePicture;
    if (isActive !== undefined) data.isActive = isActive;
    if (password) data.password = await bcrypt.hash(password, 10);

    const user = await prisma.userProfile.update({
      where: { id: userId },
      data
    });

    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
