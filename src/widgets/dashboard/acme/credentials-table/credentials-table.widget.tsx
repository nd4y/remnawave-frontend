import {
    ActionIcon,
    Badge,
    Button,
    Code,
    Group,
    Paper,
    Stack,
    Table,
    Text,
    Tooltip
} from '@mantine/core'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { useState } from 'react'
import { TbPencil, TbPlugConnected, TbPlus, TbTrash } from 'react-icons/tb'
import { z } from 'zod'

import { queryClient } from '@shared/api'
import { AcmeCredentialSchema } from '@shared/api/contracts/acme.contract'
import { QueryKeys, useDeleteAcmeCredential, useTestAcmeCredential } from '@shared/api/hooks'

import { AcmeCredentialModalWidget } from '../credential-modal/credential-modal.widget'

type Credential = z.infer<typeof AcmeCredentialSchema>

interface IProps {
    credentials: Credential[]
}

export const AcmeCredentialsTableWidget = ({ credentials }: IProps) => {
    const [editing, setEditing] = useState<Credential | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)

    const testCredential = useTestAcmeCredential({})
    const deleteCredential = useDeleteAcmeCredential({})

    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: QueryKeys.acme.getCredentials.queryKey })

    const handleTest = async (credential: Credential) => {
        const result = await testCredential.mutateAsync({ route: { uuid: credential.uuid } })

        notifications.show({
            autoClose: 10_000,
            color: result.isOk ? 'teal' : 'red',
            message: [
                result.message,
                result.allow.length > 0 ? `Allowed: ${result.allow.join(', ')}` : '',
                result.zones.length > 0 ? `Zones: ${result.zones.join(', ')}` : ''
            ]
                .filter(Boolean)
                .join(' — '),
            title: credential.name
        })
    }

    const handleDelete = (credential: Credential) => {
        modals.openConfirmModal({
            children: (
                <Text size="sm">
                    Delete credential <b>{credential.name}</b>? Certificates using it would no
                    longer be able to renew.
                </Text>
            ),
            confirmProps: { color: 'red' },
            labels: { cancel: 'Cancel', confirm: 'Delete' },
            onConfirm: async () => {
                await deleteCredential.mutateAsync({ route: { uuid: credential.uuid } })
                await invalidate()
            },
            title: 'Delete credential'
        })
    }

    return (
        <Stack gap="md">
            <Group justify="space-between">
                <Text c="dimmed" size="sm">
                    Credentials answer DNS challenges. They are reusable: many certificates can
                    share one.
                </Text>

                <Button
                    leftSection={<TbPlus size={16} />}
                    onClick={() => {
                        setEditing(null)
                        setIsModalOpen(true)
                    }}
                >
                    Add credential
                </Button>
            </Group>

            <Paper p="0" withBorder>
                <Table highlightOnHover striped>
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th>Name</Table.Th>
                            <Table.Th>Provider</Table.Th>
                            <Table.Th>Endpoint</Table.Th>
                            <Table.Th>Secret</Table.Th>
                            <Table.Th>Certificates</Table.Th>
                            <Table.Th />
                        </Table.Tr>
                    </Table.Thead>

                    <Table.Tbody>
                        {credentials.length === 0 && (
                            <Table.Tr>
                                <Table.Td colSpan={6}>
                                    <Text c="dimmed" py="md" ta="center">
                                        No credentials yet.
                                    </Text>
                                </Table.Td>
                            </Table.Tr>
                        )}

                        {credentials.map((credential) => (
                            <Table.Tr key={credential.uuid}>
                                <Table.Td>{credential.name}</Table.Td>
                                <Table.Td>
                                    <Badge variant="light">{credential.provider}</Badge>
                                </Table.Td>
                                <Table.Td>
                                    {credential.baseUrl ? (
                                        <Code>{credential.baseUrl}</Code>
                                    ) : (
                                        <Text c="dimmed">—</Text>
                                    )}
                                </Table.Td>
                                <Table.Td>
                                    {credential.hasSecret ? (
                                        <Badge color="teal" variant="light">
                                            stored
                                        </Badge>
                                    ) : (
                                        <Badge color="gray" variant="light">
                                            none
                                        </Badge>
                                    )}
                                </Table.Td>
                                <Table.Td>{credential.certificatesCount}</Table.Td>
                                <Table.Td>
                                    <Group gap="xs" justify="flex-end">
                                        <Tooltip label="Check the credential and show what it may do">
                                            <ActionIcon
                                                loading={testCredential.isPending}
                                                onClick={() => handleTest(credential)}
                                                variant="subtle"
                                            >
                                                <TbPlugConnected size={18} />
                                            </ActionIcon>
                                        </Tooltip>

                                        <ActionIcon
                                            onClick={() => {
                                                setEditing(credential)
                                                setIsModalOpen(true)
                                            }}
                                            variant="subtle"
                                        >
                                            <TbPencil size={18} />
                                        </ActionIcon>

                                        <ActionIcon
                                            color="red"
                                            onClick={() => handleDelete(credential)}
                                            variant="subtle"
                                        >
                                            <TbTrash size={18} />
                                        </ActionIcon>
                                    </Group>
                                </Table.Td>
                            </Table.Tr>
                        ))}
                    </Table.Tbody>
                </Table>
            </Paper>

            <AcmeCredentialModalWidget
                credential={editing}
                onClose={() => setIsModalOpen(false)}
                opened={isModalOpen}
            />
        </Stack>
    )
}
