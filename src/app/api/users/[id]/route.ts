import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { Role } from '@prisma/client';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { username, name, email, phoneNumber, password, role, pageAccess, profilePicture, isActive } = await request.json();

    const existing = await prisma.userProfile.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    if (username && username !== existing.username) {
      const usernameExists = await prisma.userProfile.findUnique({ where: { username } });
      if (usernameExists) return NextResponse.json({ error: 'Username already in use' }, { status: 409 });
    }

    if (email && email !== existing.email) {
      const emailExists = await prisma.userProfile.findUnique({ where: { email } });
      if (emailExists) return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
    }

    const data: any = {};
    if (username !== undefined) data.username = username;
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;
    if (phoneNumber !== undefined) data.phoneNumber = phoneNumber;
    if (role !== undefined) data.role = role as Role;
    if (pageAccess !== undefined) data.pageAccess = pageAccess;
    if (profilePicture !== undefined) data.profilePicture = profilePicture;
    if (isActive !== undefined) data.isActive = isActive;
    if (password) data.password = await hashPassword(password);

    const user = await prisma.userProfile.update({
      where: { id },
      data
    });

    const { password: _, ...userWithoutPassword } = user;
    return NextResponse.json(userWithoutPassword);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
