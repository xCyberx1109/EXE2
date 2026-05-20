import { Router } from 'express';
import prisma from '../prisma/client.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { sendMail } from '../utils/sendMail.js';
import { authService } from '../modules/auth/auth.service.js';
import { userRepository } from '../repositories/user.repository.js';
import crypto from 'crypto';

const router = Router();

// Lấy danh sách chi nhánh (branches) từ database
router.get('/branches', asyncHandler(async (req, res) => {
  const branches = await prisma.branch.findMany({
    orderBy: {
      name: 'asc'
    },
    include: {
      accounts: {
        where: {
          role: 'MANAGER'
        },
        take: 1
      }
    }
  });

  const formattedBranches = branches.map((branch) => ({
    ...branch,
    account: branch.accounts?.[0] ?? null,
    accounts: undefined,
  }));

  sendSuccess(res, {
    message: 'Lấy danh sách chi nhánh thành công',
    data: formattedBranches
  });
}));

router.post('/branches', asyncHandler(async (req, res) => {
  const {
    name,
    address,
    phone,
    plan,
    subscriptionStatus = 'ACTIVE',
    subscriptionStart,
    subscriptionEnd,
    active = true,
    email,
    fullName = '',
  } = req.body;

  if (!name || !address || !phone || !plan || !subscriptionStart || !subscriptionEnd || !email) {
    return sendError(res, {
      statusCode: 400,
      message: 'Vui lòng nhập đầy đủ tên chi nhánh, địa chỉ, số điện thoại, email, gói và thời hạn đăng ký',
    });
  }

  // Tạo branch trước
  const branch = await prisma.branch.create({
    data: {
      name,
      address,
      phone,
      plan,
      subscriptionStatus,
      subscriptionStart: new Date(subscriptionStart),
      subscriptionEnd: new Date(subscriptionEnd),
      active: Boolean(active),
    },
  });

  // Sinh mật khẩu ngẫu nhiên
  const password = crypto.randomBytes(4).toString('hex'); // 8 ký tự
  const hashedPassword = authService.hashPassword
    ? await authService.hashPassword(password)
    : await (await import('bcrypt')).hash(password, 10);

  // Tạo account MANAGER cho branch
  const account = await userRepository.create({
    email,
    password: hashedPassword,
    fullName,
    role: 'MANAGER',
    branchId: branch.id,
  });

  const formattedBranch = {
    ...branch,
    account,
  };

  // Gửi email thông báo mật khẩu
  try {
    await sendMail({
      to: email,
      subject: 'Tài khoản quản lý chi nhánh mới',
      html: `<p>Xin chào,</p>
        <p>Chi nhánh <b>${name}</b> đã được tạo thành công.</p>
        <p>Tài khoản quản lý:</p>
        <ul>
          <li>Email: <b>${email}</b></li>
          <li>Mật khẩu: <b>${password}</b></li>
        </ul>
        <p>Vui lòng đăng nhập và đổi mật khẩu sau khi sử dụng lần đầu.</p>`,
    });
  } catch (err) {
    // Nếu gửi mail lỗi, vẫn trả về branch đúng format để frontend không lỗi
    return sendSuccess(res, {
      statusCode: 201,
      message: 'Tạo chi nhánh thành công nhưng gửi email thất bại',
      data: formattedBranch,
    });
  }

  sendSuccess(res, {
    statusCode: 201,
    message: 'Tạo chi nhánh thành công, đã gửi email tài khoản quản lý',
    data: formattedBranch,
  });
}));

router.put('/branches/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    name,
    address,
    phone,
    plan,
    subscriptionStatus,
    subscriptionStart,
    subscriptionEnd,
    active,
    email,
    fullName = '',
  } = req.body;

  // Cập nhật branch trước
  const branch = await prisma.branch.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(address !== undefined && { address }),
      ...(phone !== undefined && { phone }),
      ...(plan !== undefined && { plan }),
      ...(subscriptionStatus !== undefined && { subscriptionStatus }),
      ...(subscriptionStart !== undefined && { subscriptionStart: new Date(subscriptionStart) }),
      ...(subscriptionEnd !== undefined && { subscriptionEnd: new Date(subscriptionEnd) }),
      ...(active !== undefined && { active: Boolean(active) }),
    },
  });

  let account = null;
  // Cập nhật email hoặc tạo account nếu được gửi lên
  if (email) {
    const existingAccount = await prisma.account.findFirst({
      where: {
        branchId: id,
        role: 'MANAGER',
      },
    });

    if (existingAccount) {
      account = await prisma.account.update({
        where: { id: existingAccount.id },
        data: {
          email,
          fullName: fullName || existingAccount.fullName,
        },
      });
    } else {
      // Nếu chưa có, tạo account mới với mật khẩu ngẫu nhiên
      const password = crypto.randomBytes(4).toString('hex');
      const hashedPassword = authService.hashPassword
        ? await authService.hashPassword(password)
        : await (await import('bcrypt')).hash(password, 10);

      account = await userRepository.create({
        email,
        password: hashedPassword,
        fullName: fullName || '',
        role: 'MANAGER',
        branchId: id,
      });

      // Gửi mail thông báo account mới
      try {
        await sendMail({
          to: email,
          subject: 'Tài khoản quản lý chi nhánh mới (Cập nhật)',
          html: `<p>Xin chào,</p>
            <p>Tài khoản quản lý cho chi nhánh <b>${branch.name}</b> đã được thiết lập.</p>
            <p>Thông tin đăng nhập:</p>
            <ul>
              <li>Email: <b>${email}</b></li>
              <li>Mật khẩu: <b>${password}</b></li>
            </ul>
            <p>Vui lòng đăng nhập và đổi mật khẩu sau khi sử dụng lần đầu.</p>`,
        });
      } catch (err) {
        console.error('Lỗi khi gửi email cập nhật account:', err);
      }
    }
  }

  // Lấy chi nhánh sau khi cập nhật kèm account
  const updatedBranch = await prisma.branch.findUnique({
    where: { id },
    include: {
      accounts: {
        where: {
          role: 'MANAGER',
        },
        take: 1,
      },
    },
  });

  const formattedBranch = {
    ...updatedBranch,
    account: updatedBranch.accounts?.[0] ?? null,
    accounts: undefined,
  };

  sendSuccess(res, {
    message: 'Cập nhật chi nhánh thành công',
    data: formattedBranch,
  });
}));

router.delete('/branches/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const branch = await prisma.branch.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!branch) {
    return sendError(res, {
      statusCode: 404,
      message: 'Không tìm thấy chi nhánh',
    });
  }

  await prisma.$transaction(async (tx) => {
    // Xóa các bảng con/phụ thuộc trước để tránh lỗi foreign key branchId
    await tx.orderItem.deleteMany({
      where: {
        order: {
          branchId: id,
        },
      },
    });

    await tx.menuItemIngredient.deleteMany({
      where: {
        OR: [
          {
            menuItem: {
              branchId: id,
            },
          },
          {
            ingredient: {
              branchId: id,
            },
          },
        ],
      },
    });

    await tx.inventoryTransaction.deleteMany({
      where: { branchId: id },
    });

    await tx.order.deleteMany({
      where: { branchId: id },
    });

    await tx.posDevice.deleteMany({
      where: { branchId: id },
    });

    await tx.menuItem.deleteMany({
      where: { branchId: id },
    });

    await tx.ingredient.deleteMany({
      where: { branchId: id },
    });

    await tx.account.deleteMany({
      where: { branchId: id },
    });

    await tx.branch.delete({
      where: { id },
    });
  });

  sendSuccess(res, {
    message: 'Xóa chi nhánh thành công',
    data: null,
  });
}));

export default router;
