import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { Role } from '@prisma/client';

export async function GET() {
  try {
    const users = await prisma.userProfile.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(users);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { username, password, name, role, email, phoneNumber, isActive, pageAccess } = await request.json();

    if (!username) return NextResponse.json({ error: 'Username is required' }, { status: 400 });

    const existing = await prisma.userProfile.findUnique({ where: { username } });
    if (existing) return NextResponse.json({ error: 'Username already exists' }, { status: 409 });

    if (email) {
      const emailExists = await prisma.userProfile.findUnique({ where: { email } });
      if (emailExists) return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
    }

    const user = await prisma.userProfile.create({
      data: {
        username,
        password: password ? await hashPassword(password) : await hashPassword('changeme'),
        name: name || username,
        email,
        phoneNumber,
        role: role as Role || 'VIEWER',
        isActive: isActive !== undefined ? isActive : true,
        pageAccess: pageAccess || [],
      }
    });

    const { password: _, ...userWithoutPassword } = user;
    return NextResponse.json(userWithoutPassword, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
