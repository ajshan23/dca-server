import bcrypt from 'bcryptjs';
import prisma from './db';



export async function main() {
  const superadminEmail = 'superadmin';
  const superadminPassword = 'SuperAdmin@1234';
  
  // Hash the password
  const hashedPassword = await bcrypt.hash(superadminPassword, 12);

  // Check if superadmin already exists
  const existingSuperadmin = await prisma.user.findFirst({
    where: {
      OR: [
        { username: superadminEmail },
        { role: 'super_admin' }
      ]
    }
  });

  if (existingSuperadmin) {
    console.log('Superadmin already exists:', existingSuperadmin);
    return;
  }

  // Create superadmin
  const superadmin = await prisma.user.create({
    data: {
      username: superadminEmail,
      passwordHash: hashedPassword,
      role: 'super_admin',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });

  console.log('Created superadmin:', {
    id: superadmin.id,
    username: superadmin.username,
    role: superadmin.role
  });
}

export async function updateSuperAdminRole() {
    const result = await prisma.user.updateMany({
      where: {
        role: 'SUPER_ADMIN',
      },
      data: {
        role: 'super_admin',
      },
    });
  
    console.log(`${result.count} user(s) updated.`);
  }
  